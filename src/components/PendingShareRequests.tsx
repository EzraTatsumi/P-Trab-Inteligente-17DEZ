import React, { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, User, Check, X, AlertTriangle, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/errorUtils';
import { Badge } from '@/components/ui/badge';

// Define o tipo de dados que será retornado pela query (JOIN de 3 tabelas)
interface PendingRequest {
    id: string;
    ptrab_id: string;
    status: string;
    created_at: string;
    
    // Dados do PTrab
    p_trab: {
        numero_ptrab: string;
        nome_operacao: string;
    };
    
    // Dados do Requerente (Profile + Metadados)
    requester: {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        raw_user_meta_data: Tables<'profiles'>['raw_user_meta_data'];
    };
}

const fetchPendingRequests = async (userId: string): Promise<PendingRequest[]> => {
    // 1. Buscar requests pendentes para PTrabs onde o usuário logado é o proprietário
    const { data, error } = await supabase
        .from('ptrab_share_requests')
        .select(`
            id, ptrab_id, status, created_at,
            p_trab:ptrab_id (numero_ptrab, nome_operacao),
            requester:requester_id (id, email, first_name, last_name, raw_user_meta_data)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching pending requests:", error);
        throw new Error(sanitizeError(error));
    }
    
    // 2. Filtrar no cliente para garantir que o usuário logado é o proprietário do PTrab
    // (Embora a RLS deva fazer isso, é uma camada extra de segurança e tipagem)
    const ownedPTrabs = await supabase.from('p_trab').select('id').eq('user_id', userId);
    const ownedIds = new Set((ownedPTrabs.data || []).map(p => p.id));
    
    const pendingRequests = (data || [])
        .filter(req => ownedIds.has(req.ptrab_id))
        .map(req => ({
            ...req,
            p_trab: req.p_trab as PendingRequest['p_trab'],
            requester: req.requester as PendingRequest['requester'],
        }));

    return pendingRequests as PendingRequest[];
};

export const PendingShareRequests: React.FC = () => {
    const { user } = useSession();
    const queryClient = useQueryClient();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const { data: requests, isLoading, error } = useQuery({
        queryKey: ['pendingShareRequests', user?.id],
        queryFn: () => fetchPendingRequests(user!.id),
        enabled: !!user?.id,
        refetchInterval: 30000, // Refetch a cada 30 segundos
    });
    
    const invalidateQueries = () => {
        queryClient.invalidateQueries({ queryKey: ['pendingShareRequests'] });
        queryClient.invalidateQueries({ queryKey: ['ptrabTotals'] });
        queryClient.invalidateQueries({ queryKey: ['ptrab'] });
    };

    const handleAction = useCallback(async (requestId: string, action: 'approve' | 'reject') => {
        setProcessingId(requestId);
        
        try {
            const rpcFunction = action === 'approve' ? 'approve_ptrab_share' : 'reject_ptrab_share';
            
            const { data: success, error } = await supabase.rpc(rpcFunction, {
                p_request_id: requestId,
            });

            if (error) throw error;
            
            if (success === false) {
                throw new Error(`Falha na ${action === 'approve' ? 'aprovação' : 'rejeição'}. Você pode não ser o proprietário do P Trab.`);
            }

            toast.success(`Solicitação ${action === 'approve' ? 'aprovada' : 'rejeitada'} com sucesso!`);
            invalidateQueries();
            
        } catch (e: any) {
            console.error(`Error during ${action}:`, e);
            toast.error(sanitizeError(e));
        } finally {
            setProcessingId(null);
        }
    }, [queryClient]);
    
    const getRequesterDetails = (requester: PendingRequest['requester']) => {
        const meta = requester.raw_user_meta_data as any;
        const postoGraduacao = meta?.posto_graduacao || 'N/A';
        const nomeGuerra = requester.last_name || 'N/A';
        const siglaOm = meta?.sigla_om || 'N/A';
        
        return { postoGraduacao, nomeGuerra, siglaOm };
    };

    if (isLoading) {
        return (
            <Card className="shadow-lg">
                <CardHeader className="py-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Share2 className="h-5 w-5 text-primary" />
                        Solicitações de Acesso
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Carregando solicitações...</span>
                </CardContent>
            </Card>
        );
    }
    
    if (error) {
        return (
            <Card className="shadow-lg border-destructive">
                <CardHeader className="py-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        Erro ao Carregar Solicitações
                    </CardTitle>
                </CardHeader>
                <CardContent className="py-4">
                    <p className="text-sm text-muted-foreground">{error.message}</p>
                </CardContent>
            </Card>
        );
    }

    const pendingRequests = requests || [];

    return (
        <Card className="shadow-lg">
            <CardHeader className="py-3">
                <CardTitle className="text-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Share2 className="h-5 w-5 text-primary" />
                        Solicitações de Acesso
                    </div>
                    {pendingRequests.length > 0 && (
                        <Badge variant="destructive" className="text-sm">
                            {pendingRequests.length} Pendente{pendingRequests.length > 1 ? 's' : ''}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {pendingRequests.length === 0 ? (
                    <div className="text-center py-6">
                        <p className="text-sm text-muted-foreground">Nenhuma solicitação de acesso pendente.</p>
                    </div>
                ) : (
                    <div className="space-y-3 p-4">
                        {pendingRequests.map((request) => {
                            const { postoGraduacao, nomeGuerra, siglaOm } = getRequesterDetails(request.requester);
                            const isProcessing = processingId === request.id;
                            
                            return (
                                <div key={request.id} className="border p-3 rounded-lg bg-muted/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                    
                                    {/* Detalhes do Requerente e PTrab */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-primary" />
                                            <span className="font-semibold text-sm truncate">
                                                {postoGraduacao} {nomeGuerra} ({siglaOm})
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">
                                            P Trab: {request.p_trab.numero_ptrab} - {request.p_trab.nome_operacao}
                                        </p>
                                    </div>
                                    
                                    {/* Ações */}
                                    <div className="flex gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            onClick={() => handleAction(request.id, 'approve')}
                                            disabled={isProcessing}
                                            className="bg-green-600 hover:bg-green-700"
                                        >
                                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                            {isProcessing ? 'Aguarde' : 'Aprovar'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleAction(request.id, 'reject')}
                                            disabled={isProcessing}
                                            className="text-destructive hover:bg-destructive/10"
                                        >
                                            <X className="h-4 w-4" />
                                            Rejeitar
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};