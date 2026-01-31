import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tables, Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Share2, Trash2, Edit, Check, X, AlertTriangle, RefreshCw, FileText, Download, Upload, Users, ExternalLink, Copy, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate, formatCodug } from "@/lib/formatUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { useAuth } from "@/hooks/useAuth";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { PTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import LinkPTrabDialog from "@/components/LinkPTrabDialog";
import SharePTrabDialog from "@/components/SharePTrabDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fetchPTrabTotals } from "@/components/PTrabCostSummary";
import PTrabCreditDialog from "@/components/PTrabCreditDialog";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";

// Tipos de dados
type PTrabRow = Tables<'p_trab'>;
type PTrabShareRequest = Tables<'ptrab_share_requests'>;
type Profile = Tables<'profiles'>;

// Tipo para a linha da tabela (mescla PTrab e Totais)
interface PTrabTableItem extends PTrabRow {
    total_gnd3: number;
    total_gnd4: number;
    owner_name: string;
    is_owner: boolean;
    is_shared: boolean;
    share_requests: PTrabShareRequest[];
}

// Tipos para o modal de compartilhamento
interface ShareRequestWithProfile extends PTrabShareRequest {
    requester_profile: Profile | null;
}

interface PTrabManagerProps {
    // Adicione props se necessário
}

const PTrabManager: React.FC<PTrabManagerProps> = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { data: oms } = useMilitaryOrganizations();
    const { data: defaultYearData } = useDefaultDiretrizYear();
    
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [ptrabToDelete, setPTrabToDelete] = useState<PTrabRow | null>(null);
    const [showLinkDialog, setShowLinkDialog] = useState(false);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [ptrabToShare, setPTrabToShare] = useState<PTrabRow | null>(null);
    const [showCreditDialog, setShowCreditDialog] = useState(false);
    const [ptrabToCredit, setPTrabToCredit] = useState<PTrabRow | null>(null);
    
    // Estado para gerenciar as solicitações de compartilhamento
    const [shareRequests, setShareRequests] = useState<ShareRequestWithProfile[]>([]);
    const [showRequestsDialog, setShowRequestsDialog] = useState(false);

    // =================================================================
    // FETCH DATA
    // =================================================================

    // 1. Fetch PTrabs do usuário (próprios e compartilhados)
    const { data: ptrabs, isLoading: isLoadingPTrabs, error: ptrabError } = useQuery<PTrabRow[]>({
        queryKey: ['userPTrabs', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            
            // Busca PTrabs onde o usuário é o dono OU está na lista shared_with
            const { data, error } = await supabase
                .from('p_trab')
                .select('*')
                .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            return data;
        },
        enabled: !!user?.id,
    });
    
    // 2. Fetch Totais de Custo para todos os PTrabs
    const { data: totalsMap, isLoading: isLoadingTotals } = useQuery<Record<string, { total_gnd3: number, total_gnd4: number }>>({
        queryKey: ['ptrabTotalsMap', ptrabs?.map(p => p.id)],
        queryFn: async () => {
            if (!ptrabs || ptrabs.length === 0) return {};
            
            const results: Record<string, { total_gnd3: number, total_gnd4: number }> = {};
            
            // Limita a 5 chamadas simultâneas para evitar sobrecarga
            const promises = ptrabs.map(async (ptrab) => {
                try {
                    const totals = await fetchPTrabTotals(ptrab.id);
                    results[ptrab.id] = {
                        total_gnd3: totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito,
                        total_gnd4: totals.totalMaterialPermanente,
                    };
                } catch (e) {
                    console.error(`Erro ao calcular total para PTrab ${ptrab.id}:`, e);
                    results[ptrab.id] = { total_gnd3: 0, total_gnd4: 0 };
                }
            });
            
            await Promise.all(promises);
            return results;
        },
        enabled: !!ptrabs && ptrabs.length > 0,
        staleTime: 1000 * 60 * 5, // 5 minutos
    });
    
    // 3. Fetch Perfis de Usuários (para exibir nomes de donos/colaboradores)
    const { data: profilesMap, isLoading: isLoadingProfiles } = useQuery<Record<string, Profile>>({
        queryKey: ['allProfiles'],
        queryFn: async () => {
            // Coleta todos os IDs de usuário relevantes (donos e compartilhados)
            const userIds = new Set<string>();
            ptrabs?.forEach(p => {
                userIds.add(p.user_id);
                p.shared_with?.forEach(id => userIds.add(id));
            });
            
            if (userIds.size === 0) return {};
            
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .in('id', Array.from(userIds));
                
            if (error) throw error;
            
            return (data || []).reduce((acc, profile) => {
                acc[profile.id] = profile;
                return acc;
            }, {} as Record<string, Profile>);
        },
        enabled: !!ptrabs && ptrabs.length > 0,
        staleTime: 1000 * 60 * 60, // 1 hora
    });
    
    // 4. Fetch Solicitações de Compartilhamento (requests onde o usuário é o dono)
    const { data: rawRequests, isLoading: isLoadingRequests } = useQuery<PTrabShareRequest[]>({
        queryKey: ['shareRequests', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            
            // Busca solicitações onde o PTrab pertence ao usuário atual
            const { data, error } = await supabase
                .from('ptrab_share_requests')
                .select('*, p_trab(user_id)')
                .eq('status', 'pending')
                .eq('p_trab.user_id', user.id); // Filtra pelo dono do PTrab

            if (error) throw error;
            return data as PTrabShareRequest[];
        },
        enabled: !!user?.id,
    });
    
    // Efeito para enriquecer as solicitações com dados do perfil
    useEffect(() => {
        if (rawRequests && profilesMap) {
            const enrichedRequests: ShareRequestWithProfile[] = rawRequests.map(req => ({
                ...req,
                requester_profile: profilesMap[req.requester_id] || null,
            }));
            setShareRequests(enrichedRequests);
        }
    }, [rawRequests, profilesMap]);

    // =================================================================
    // PROCESSAMENTO DE DADOS
    // =================================================================

    const processedPTrabs = useMemo<PTrabTableItem[]>(() => {
        if (!ptrabs || !totalsMap || !profilesMap) return [];

        return ptrabs.map(ptrab => {
            const totals = totalsMap[ptrab.id] || { total_gnd3: 0, total_gnd4: 0 };
            const ownerProfile = profilesMap[ptrab.user_id];
            const isOwner = ptrab.user_id === user?.id;
            const isShared = !isOwner && ptrab.shared_with?.includes(user?.id || '');
            
            return {
                ...ptrab,
                total_gnd3: totals.total_gnd3,
                total_gnd4: totals.total_gnd4,
                owner_name: ownerProfile ? `${ownerProfile.first_name} ${ownerProfile.last_name}` : 'Desconhecido',
                is_owner: isOwner,
                is_shared: isShared,
                share_requests: [], // Não usado aqui, mas mantido para compatibilidade
            };
        });
    }, [ptrabs, totalsMap, profilesMap, user?.id]);
    
    // =================================================================
    // HANDLERS DE AÇÃO
    // =================================================================

    const handleCreateNew = () => {
        navigate('/ptrab/form');
    };

    const handleEdit = (ptrabId: string) => {
        navigate(`/ptrab/form?ptrabId=${ptrabId}`);
    };
    
    const handleReport = (ptrabId: string) => {
        navigate(`/ptrab/report?ptrabId=${ptrabId}`);
    };

    const handleConfirmDelete = (ptrab: PTrabRow) => {
        setPTrabToDelete(ptrab);
        setShowDeleteDialog(true);
    };

    const handleDelete = async () => {
        if (!ptrabToDelete) return;

        const id = ptrabToDelete.id;
        
        try {
            // 1. Deletar registros de todas as tabelas filhas (usando a lista de tabelas)
            const tablesToDelete: (keyof Tables)[] = [
                'classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 
                'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 
                'classe_viii_saude_registros', 'classe_viii_remonta_registros', 
                'classe_ix_registros', 'diaria_registros', 'verba_operacional_registros',
                'passagem_registros', 'p_trab_ref_lpc', 'ptrab_share_requests'
            ];
            
            const deletePromises = tablesToDelete.map(tableName => 
                supabase.from(tableName).delete().eq('p_trab_id', id)
            );
            
            await Promise.all(deletePromises);

            // 2. Deletar o PTrab principal
            const { error: ptrabError } = await supabase
                .from('p_trab')
                .delete()
                .eq('id', id);

            if (ptrabError) throw ptrabError;

            toast.success(`P Trab ${ptrabToDelete.numero_ptrab || 'sem número'} excluído com sucesso.`);
            queryClient.invalidateQueries({ queryKey: ['userPTrabs'] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotalsMap'] });
            setShowDeleteDialog(false);
            setPTrabToDelete(null);
        } catch (error) {
            toast.error("Falha ao excluir P Trab.", { description: sanitizeError(error) });
        }
    };
    
    // --- Handlers de Compartilhamento ---
    
    const handleOpenShareDialog = (ptrab: PTrabRow) => {
        setPTrabToShare(ptrab);
        setShowShareDialog(true);
    };
    
    const handleOpenLinkDialog = () => {
        setShowLinkDialog(true);
    };
    
    const handleOpenCreditDialog = (ptrab: PTrabRow) => {
        setPTrabToCredit(ptrab);
        setShowCreditDialog(true);
    };
    
    const handleRequestShare = async (ptrabId: string, shareToken: string) => {
        try {
            if (!user?.id) throw new Error("Usuário não autenticado.");
            
            // CORREÇÃO: Chamada de função RPC
            const { data, error } = await supabase.rpc('request_ptrab_share', {
                p_ptrab_id: ptrabId,
                p_share_token: shareToken,
                p_user_id: user.id,
            });

            if (error) throw error;
            
            if (data === true) {
                toast.success("Solicitação de acesso enviada com sucesso!");
            } else {
                toast.warning("Token inválido ou P Trab não encontrado.");
            }
            
            queryClient.invalidateQueries({ queryKey: ['shareRequests'] });
            queryClient.invalidateQueries({ queryKey: ['userPTrabs'] });
            setShowLinkDialog(false);
        } catch (error) {
            toast.error("Falha ao solicitar acesso.", { description: sanitizeError(error) });
        }
    };
    
    const handleApproveRequest = async (requestId: string) => {
        try {
            // CORREÇÃO: Chamada de função RPC
            const { data, error } = await supabase.rpc('approve_ptrab_share', {
                p_request_id: requestId,
            });

            if (error) throw error;
            
            if (data === true) {
                toast.success("Solicitação aprovada. O usuário agora tem acesso.");
            } else {
                toast.error("Falha ao aprovar. Verifique se você é o dono do P Trab.");
            }
            
            queryClient.invalidateQueries({ queryKey: ['shareRequests'] });
            queryClient.invalidateQueries({ queryKey: ['userPTrabs'] });
        } catch (error) {
            toast.error("Falha ao aprovar solicitação.", { description: sanitizeError(error) });
        }
    };
    
    const handleRejectRequest = async (requestId: string) => {
        try {
            // CORREÇÃO: Chamada de função RPC
            const { data, error } = await supabase.rpc('reject_ptrab_share', {
                p_request_id: requestId,
            });

            if (error) throw error;
            
            if (data === true) {
                toast.info("Solicitação rejeitada.");
            } else {
                toast.error("Falha ao rejeitar. Verifique se você é o dono do P Trab.");
            }
            
            queryClient.invalidateQueries({ queryKey: ['shareRequests'] });
        } catch (error) {
            toast.error("Falha ao rejeitar solicitação.", { description: sanitizeError(error) });
        }
    };
    
    const handleRemoveCollaborator = async (ptrabId: string, userIdToRemove: string, userName: string) => {
        if (!confirm(`Tem certeza que deseja remover o acesso de ${userName} a este P Trab?`)) return;
        
        try {
            // CORREÇÃO: Chamada de função RPC
            const { data, error } = await supabase.rpc('remove_user_from_shared_with', {
                p_ptrab_id: ptrabId,
                p_user_to_remove_id: userIdToRemove,
            });

            if (error) throw error;
            
            if (data === true) {
                toast.success(`Acesso de ${userName} removido com sucesso.`);
            } else {
                toast.error("Falha ao remover acesso. Verifique as permissões.");
            }
            
            queryClient.invalidateQueries({ queryKey: ['userPTrabs'] });
        } catch (error) {
            toast.error("Falha ao remover colaborador.", { description: sanitizeError(error) });
        }
    };
    
    const handleUnlinkPTrab = async (ptrabId: string, ptrabName: string) => {
        if (!user?.id) return;
        if (!confirm(`Tem certeza que deseja remover sua vinculação com o P Trab ${ptrabName}? Você perderá o acesso.`)) return;
        
        try {
            // CORREÇÃO: Chamada de função RPC
            const { data, error } = await supabase.rpc('remove_user_from_shared_with', {
                p_ptrab_id: ptrabId,
                p_user_to_remove_id: user.id,
            });

            if (error) throw error;
            
            if (data === true) {
                toast.success(`Vinculação com ${ptrabName} removida.`);
            } else {
                toast.error("Falha ao remover vinculação.");
            }
            
            queryClient.invalidateQueries({ queryKey: ['userPTrabs'] });
        } catch (error) {
            toast.error("Falha ao desvincular P Trab.", { description: sanitizeError(error) });
        }
    };
    
    // --- Renderização Auxiliar ---
    
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'aberto':
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Aberto</Badge>;
            case 'em_revisao':
                return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Em Revisão</Badge>;
            case 'aprovado':
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aprovado</Badge>;
            case 'arquivado':
                return <Badge variant="outline" className="bg-gray-100 text-gray-600 hover:bg-gray-100">Arquivado</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const isPTrabEditable = (status: string) => status !== 'aprovado' && status !== 'arquivado';
    
    const isLoading = isLoadingPTrabs || isLoadingTotals || isLoadingProfiles || isLoadingRequests;

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Gerenciamento de Planos de Trabalho</h1>
                    <div className="flex gap-3">
                        <Button 
                            variant="outline" 
                            onClick={handleOpenLinkDialog}
                            disabled={isLoading}
                        >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Vincular P Trab
                        </Button>
                        <Button onClick={handleCreateNew} disabled={isLoading}>
                            <Plus className="mr-2 h-4 w-4" />
                            Novo P Trab
                        </Button>
                    </div>
                </div>
                
                {/* Seção de Solicitações de Acesso */}
                {shareRequests.length > 0 && (
                    <Card className="border-2 border-blue-500 bg-blue-50/50 shadow-lg">
                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-lg font-semibold text-blue-700 flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Solicitações de Acesso Pendentes ({shareRequests.length})
                            </CardTitle>
                            <Button variant="secondary" onClick={() => setShowRequestsDialog(true)}>
                                Visualizar Solicitações
                            </Button>
                        </CardHeader>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Meus PTrabs ({processedPTrabs.length})</CardTitle>
                        <CardDescription>
                            Lista de Planos de Trabalho criados por você ou compartilhados com você.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="ml-2 text-muted-foreground">Carregando PTrabs...</span>
                            </div>
                        ) : processedPTrabs.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-xl font-semibold">Nenhum Plano de Trabalho encontrado.</h3>
                                <p className="text-muted-foreground mt-2">
                                    Crie um novo P Trab ou vincule-se a um existente usando o token de compartilhamento.
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px]">Nº P Trab</TableHead>
                                        <TableHead>Operação / OM</TableHead>
                                        <TableHead>Período</TableHead>
                                        <TableHead className="text-right">Total GND 3</TableHead>
                                        <TableHead className="text-right">Total GND 4</TableHead>
                                        <TableHead className="w-[120px] text-center">Status</TableHead>
                                        <TableHead className="w-[150px] text-center">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {processedPTrabs.map((ptrab) => (
                                        <TableRow key={ptrab.id} className={cn(ptrab.is_shared && "bg-yellow-50/50 hover:bg-yellow-50")}>
                                            <TableCell className="font-medium">
                                                {ptrab.numero_ptrab || 'Minuta'}
                                                {ptrab.is_shared && (
                                                    <Badge variant="outline" className="ml-2 text-xs bg-yellow-200 text-yellow-800">
                                                        Compartilhado
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <p className="font-semibold">{ptrab.nome_operacao}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {ptrab.nome_om} ({formatCodug(ptrab.codug_om)})
                                                </p>
                                                {!ptrab.is_owner && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Dono: {ptrab.owner_name}
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {formatDate(ptrab.periodo_inicio)} - {formatDate(ptrab.periodo_fim)}
                                                <p className="text-xs text-muted-foreground">
                                                    Atualizado: {formatDate(ptrab.updated_at)}
                                                </p>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-lg text-orange-600">
                                                {formatCurrency(ptrab.total_gnd3)}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-lg text-green-600">
                                                {formatCurrency(ptrab.total_gnd4)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {getStatusBadge(ptrab.status)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex gap-2 justify-center">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => handleReport(ptrab.id)}
                                                        title="Gerar Relatório"
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                    </Button>
                                                    {isPTrabEditable(ptrab.status) && (
                                                        <Button 
                                                            variant="secondary" 
                                                            size="sm" 
                                                            onClick={() => handleEdit(ptrab.id)}
                                                            title="Editar P Trab"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {ptrab.is_owner && isPTrabEditable(ptrab.status) && (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={() => handleOpenShareDialog(ptrab)}
                                                            title="Compartilhar"
                                                        >
                                                            <Share2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {ptrab.is_owner && (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={() => handleOpenCreditDialog(ptrab)}
                                                            title="Informar Crédito"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {ptrab.is_owner ? (
                                                        <Button 
                                                            variant="destructive" 
                                                            size="sm" 
                                                            onClick={() => handleConfirmDelete(ptrab)}
                                                            title="Excluir P Trab"
                                                            disabled={!isPTrabEditable(ptrab.status)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    ) : (
                                                        <Button 
                                                            variant="destructive" 
                                                            size="sm" 
                                                            onClick={() => handleUnlinkPTrab(ptrab.id, ptrab.nome_operacao)}
                                                            title="Remover Vinculação"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Diálogo de Exclusão */}
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                                <Trash2 className="h-5 w-5" />
                                Confirmar Exclusão
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir o P Trab <span className="font-bold">{ptrabToDelete?.numero_ptrab || ptrabToDelete?.nome_operacao}</span>? Todos os registros associados serão permanentemente removidos. Esta ação é irreversível.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={handleDelete}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Excluir Permanentemente
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                
                {/* Diálogo de Vincular P Trab */}
                <LinkPTrabDialog
                    open={showLinkDialog}
                    onOpenChange={setShowLinkDialog}
                    onRequestShare={handleRequestShare}
                />
                
                {/* Diálogo de Compartilhamento */}
                {ptrabToShare && (
                    <SharePTrabDialog
                        open={showShareDialog}
                        onOpenChange={setShowShareDialog}
                        ptrab={ptrabToShare}
                        profilesMap={profilesMap || {}}
                        onRemoveCollaborator={handleRemoveCollaborator}
                    />
                )}
                
                {/* Diálogo de Crédito */}
                {ptrabToCredit && (
                    <PTrabCreditDialog
                        open={showCreditDialog}
                        onOpenChange={setShowCreditDialog}
                        ptrab={ptrabToCredit}
                        currentCreditGND3={ptrabToCredit.credit_gnd3 || 0}
                        currentCreditGND4={ptrabToCredit.credit_gnd4 || 0}
                    />
                )}
                
                {/* Diálogo de Solicitações Pendentes */}
                <AlertDialog open={showRequestsDialog} onOpenChange={setShowRequestsDialog}>
                    <AlertDialogContent className="max-w-lg">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-blue-700">
                                <Users className="h-5 w-5" />
                                Solicitações de Acesso
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Gerencie as solicitações de acesso pendentes para seus PTrabs.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="max-h-[400px] overflow-y-auto space-y-3 p-1">
                            {shareRequests.length === 0 ? (
                                <p className="text-muted-foreground text-sm text-center py-4">Nenhuma solicitação pendente.</p>
                            ) : (
                                shareRequests.map(req => (
                                    <Card key={req.id} className="p-3 border-l-4 border-blue-400">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold text-sm">
                                                    {req.requester_profile?.first_name} {req.requester_profile?.last_name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Solicitou acesso ao P Trab: <span className="font-medium text-foreground">{ptrabs?.find(p => p.id === req.ptrab_id)?.nome_operacao || 'P Trab Desconhecido'}</span>
                                                </p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <Button 
                                                    variant="default" 
                                                    size="sm" 
                                                    onClick={() => handleApproveRequest(req.id)}
                                                    disabled={isLoading}
                                                >
                                                    <Check className="h-4 w-4 mr-1" />
                                                    Aprovar
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => handleRejectRequest(req.id)}
                                                    disabled={isLoading}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Fechar</AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};

export default PTrabManager;