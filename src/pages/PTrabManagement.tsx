import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { Loader2, Plus, FileText, Edit, Trash2, Users, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { sanitizeError } from '@/lib/errorUtils';

type PTrab = Tables<'p_trab'>;

const PTrabManagement = () => {
    const navigate = useNavigate();
    const { user, isLoading: isLoadingSession } = useSession();
    const queryClient = useQueryClient();
    
    const [isCreating, setIsCreating] = useState(false);

    // Função para buscar os PTrabs do usuário
    const fetchPTrabs = async (): Promise<PTrab[]> => {
        if (!user?.id) return [];
        
        const { data, error } = await supabase
            .from('p_trab')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return data as PTrab[];
    };

    const { data: pTrabs, isLoading: isLoadingPTrabs, refetch } = useQuery<PTrab[]>({
        queryKey: ['userPTrabs', user?.id],
        queryFn: fetchPTrabs,
        enabled: !!user?.id,
    });
    
    // Função para criar um novo PTrab (mínimo)
    const createPTrabMutation = useMutation({
        mutationFn: async () => {
            if (!user?.id) throw new Error("Usuário não autenticado.");
            
            // Valores mínimos para criar um PTrab no status 'aberto'
            const newPTrabData: TablesInsert<'p_trab'> = {
                user_id: user.id,
                comando_militar_area: 'CMDO PADRÃO', // Placeholder
                nome_om: 'OM PADRÃO', // Placeholder
                nome_operacao: 'Nova Operação',
                periodo_inicio: new Date().toISOString().split('T')[0],
                periodo_fim: new Date().toISOString().split('T')[0],
                efetivo_empregado: '1',
                numero_ptrab: `PTrab-${Date.now()}`, // Número temporário
                status: 'aberto',
            };

            const { data, error } = await supabase
                .from('p_trab')
                .insert([newPTrabData])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (newPTrab) => {
            queryClient.invalidateQueries({ queryKey: ['userPTrabs', user?.id] });
            toast.success("Novo P Trab criado com sucesso!");
            navigate(`/ptrab/form?ptrabId=${newPTrab.id}`);
        },
        onError: (error) => {
            toast.error("Falha ao criar novo P Trab.", { description: sanitizeError(error) });
        },
        onSettled: () => {
            setIsCreating(false);
        }
    });
    
    const handleCreateNewPTrab = () => {
        if (createPTrabMutation.isPending) return;
        setIsCreating(true);
        createPTrabMutation.mutate();
    };
    
    const handleEditPTrab = (ptrabId: string) => {
        navigate(`/ptrab/form?ptrabId=${ptrabId}`);
    };
    
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'aberto':
                return <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">Aberto</Badge>;
            case 'em_andamento':
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-300">Em Andamento</Badge>;
            case 'completo':
                return <Badge className="bg-blue-100 text-blue-700 border-blue-300">Completo</Badge>;
            case 'aprovado':
                return <Badge className="bg-primary/10 text-primary border-primary/30 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Aprovado</Badge>;
            case 'arquivado':
                return <Badge variant="outline" className="text-muted-foreground">Arquivado</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (isLoadingSession || isLoadingPTrabs) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando Planos de Trabalho...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <FileText className="h-7 w-7 text-primary" />
                        Gerenciamento de Planos de Trabalho (P Trab)
                    </h1>
                    <Button 
                        onClick={handleCreateNewPTrab} 
                        disabled={isCreating}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Novo P Trab
                    </Button>
                </div>

                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Meus Planos de Trabalho</CardTitle>
                        <CardDescription>
                            Lista de P Trabs criados e compartilhados com você.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {pTrabs && pTrabs.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px]">Status</TableHead>
                                        <TableHead>Número / Operação</TableHead>
                                        <TableHead>OM</TableHead>
                                        <TableHead className="text-center">Período (Dias)</TableHead>
                                        <TableHead className="text-right w-[100px]">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pTrabs.map((ptrab) => {
                                        const days = ptrab.periodo_inicio && ptrab.periodo_fim 
                                            ? Math.ceil((new Date(ptrab.periodo_fim).getTime() - new Date(ptrab.periodo_inicio).getTime()) / (1000 * 3600 * 24)) + 1
                                            : 0;
                                            
                                        return (
                                            <TableRow key={ptrab.id}>
                                                <TableCell>{getStatusBadge(ptrab.status)}</TableCell>
                                                <TableCell>
                                                    <p className="font-medium">{ptrab.numero_ptrab}</p>
                                                    <p className="text-sm text-muted-foreground">{ptrab.nome_operacao}</p>
                                                </TableCell>
                                                <TableCell>{ptrab.nome_om}</TableCell>
                                                <TableCell className="text-center">{days}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => handleEditPTrab(ptrab.id)}
                                                        title="Editar P Trab"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center py-8">
                                <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
                                <p className="text-lg font-medium">Nenhum Plano de Trabalho encontrado.</p>
                                <p className="text-muted-foreground">Clique em "Novo P Trab" para começar.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default PTrabManagement;