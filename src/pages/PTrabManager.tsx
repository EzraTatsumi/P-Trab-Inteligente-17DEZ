import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useQueries, useMutation } from "@tanstack/react-query"; // Adicionado useMutation
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, FileText, Pencil, Trash2, Share2, Copy, Check, AlertCircle, TrendingUp, Settings, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/SessionContextProvider";
import { formatCurrency, formatDate } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";
import { fetchPTrabTotals } from "@/components/PTrabCostSummary";
import { Tables } from "@/integrations/supabase/types";
import { preparePTrabForCloning } from "@/lib/ptrabCloneUtils";
import { CreditInputDialog } from "@/components/CreditInputDialog";
import { fetchUserCredits, updateUserCredits } from "@/lib/creditUtils";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { CloneVariationDialog } from "@/components/CloneVariationDialog";
import { CreditPromptDialog } from "@/components/CreditPromptDialog";

type PTrabRow = Tables<'p_trab'>;

// Interface estendida para incluir os totais calculados
interface PTrabWithTotals extends PTrabRow {
  totalLogistica?: number;
  totalOperacional?: number;
  totalMaterialPermanente?: number;
  totalAviacaoExercito?: number;
}

const PTrabManager = () => {
  const navigate = useNavigate();
  const { user, loading: loadingSession } = useSession();
  const queryClient = useQueryClient();
  
  const [filterStatus, setFilterStatus] = useState<string>("aberto");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [ptrabToDelete, setPtrabToDelete] = useState<PTrabWithTotals | null>(null);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [ptrabToClone, setPtrabToClone] = useState<PTrabWithTotals | null>(null);
  const [showCreditPrompt, setShowCreditPrompt] = useState(false);

  // --- Lógica de Busca de PTrabs (TanStack Query) ---
  const { data: ptrabs, isLoading: isLoadingPTrabs, refetch: refetchPTrabs } = useQuery({
    queryKey: ['ptrabs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('p_trab')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Inicializa os totais como undefined para que o useQueries possa preenchê-los
      return (data || []) as PTrabWithTotals[];
    },
    enabled: !!user?.id,
    initialData: [],
  });
  
  // --- Lógica de Busca de Créditos (TanStack Query) ---
  const { data: credits, isLoading: isLoadingCredits } = useQuery({
    queryKey: ['userCredits', user?.id],
    queryFn: () => fetchUserCredits(user!.id),
    enabled: !!user?.id,
    initialData: { credit_gnd3: 0, credit_gnd4: 0 },
  });

  // --- Lógica de Busca de Totais para CADA PTrab (useQueries) ---
  const ptrabQueries = ptrabs.map(ptrab => ({
    queryKey: ['ptrabTotals', ptrab.id],
    queryFn: () => fetchPTrabTotals(ptrab.id),
    enabled: !!ptrab.id,
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
  }));

  // CORREÇÃO: Usar useQueries para executar múltiplas queries
  const ptrabTotalsResults = useQueries({ queries: ptrabQueries });
  
  // --- Combinação de PTrabs com Totais ---
  const ptrabsWithTotals = useMemo(() => {
    return ptrabs.map((ptrab, index) => {
      const totalsResult = ptrabTotalsResults[index];
      if (totalsResult && totalsResult.data) {
        return {
          ...ptrab,
          totalLogistica: totalsResult.data.totalLogistica,
          totalOperacional: totalsResult.data.totalOperacional,
          totalMaterialPermanente: totalsResult.data.totalMaterialPermanente,
          totalAviacaoExercito: totalsResult.data.totalAviacaoExercito,
        };
      }
      return ptrab;
    });
  }, [ptrabs, ptrabTotalsResults]);
  
  // --- Filtragem e Busca ---
  const filteredPTrabs = useMemo(() => {
    return ptrabsWithTotals
      .filter(ptrab => filterStatus === 'todos' || ptrab.status === filterStatus)
      .filter(ptrab => 
        ptrab.numero_ptrab?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ptrab.nome_operacao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ptrab.nome_om.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [ptrabsWithTotals, filterStatus, searchTerm]);
  
  // --- Totais Consolidados (GND 3 e GND 4) ---
  const totalGND3Consolidado = useMemo(() => {
    return ptrabsWithTotals.reduce((sum, ptrab) => {
      const logistica = ptrab.totalLogistica || 0;
      const operacional = ptrab.totalOperacional || 0;
      const aviacao = ptrab.totalAviacaoExercito || 0;
      return sum + logistica + operacional + aviacao;
    }, 0);
  }, [ptrabsWithTotals]);

  const totalGND4Consolidado = useMemo(() => {
    return ptrabsWithTotals.reduce((sum, ptrab) => {
      return sum + (ptrab.totalMaterialPermanente || 0);
    }, 0);
  }, [ptrabsWithTotals]);
  
  const saldoGND3 = credits.credit_gnd3 - totalGND3Consolidado;
  const saldoGND4 = credits.credit_gnd4 - totalGND4Consolidado;
  
  // --- Lógica de Mutação para Salvar Créditos (Usando useMutation) ---
  const saveCreditsMutation = useMutation({
    mutationKey: ['updateUserCredits'],
    mutationFn: ({ gnd3, gnd4 }: { gnd3: number, gnd4: number }) => 
      updateUserCredits(user!.id, gnd3, gnd4),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCredits', user?.id] });
      toast.success("Créditos disponíveis atualizados e salvos!");
    },
    onError: (error) => {
      toast.error(error.message || "Falha ao salvar créditos.");
    }
  });

  const handleSaveCredit = (gnd3: number, gnd4: number) => {
    if (!user?.id) {
      toast.error("Erro: Usuário não identificado para salvar créditos.");
      return;
    }
    saveCreditsMutation.mutate({ gnd3, gnd4 });
  };

  // --- Handlers de Ação ---
  const handleCreateNew = () => {
    navigate('/ptrab/form');
  };

  const handleEdit = (ptrab: PTrabWithTotals) => {
    if (ptrab.status === 'arquivado') {
      toast.warning("P Trab arquivado não pode ser editado.");
      return;
    }
    navigate(`/ptrab/form?ptrabId=${ptrab.id}`);
  };
  
  const handleViewReport = (ptrab: PTrabWithTotals) => {
    navigate(`/ptrab/print?ptrabId=${ptrab.id}`);
  };

  const handleDelete = (ptrab: PTrabWithTotals) => {
    if (ptrab.status === 'arquivado') {
      toast.warning("P Trab arquivado não pode ser excluído.");
      return;
    }
    setPtrabToDelete(ptrab);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!ptrabToDelete) return;
    
    try {
      const { error } = await supabase
        .from('p_trab')
        .delete()
        .eq('id', ptrabToDelete.id);

      if (error) throw error;

      toast.success(`P Trab ${ptrabToDelete.numero_ptrab} excluído com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['ptrabs', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabToDelete.id] });
      
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir P Trab.");
    } finally {
      setShowDeleteDialog(false);
      setPtrabToDelete(null);
    }
  };
  
  const handleClone = (ptrab: PTrabWithTotals) => {
    setPtrabToClone(ptrab);
    setShowCloneDialog(true);
  };
  
  const handleConfirmClone = async (variation: 'original' | 'versao') => {
    if (!ptrabToClone || !user?.id) return;
    
    try {
      // 1. Prepara os dados do PTrab, removendo share_token e outros campos gerados
      const newPTrabData = preparePTrabForCloning(ptrabToClone, user.id);
      
      if (variation === 'versao') {
        newPTrabData.origem = 'versao';
        newPTrabData.rotulo_versao = `Versão de ${ptrabToClone.numero_ptrab} - ${new Date().toLocaleDateString('pt-BR')}`;
      }
      
      // 2. Insere o novo PTrab
      const { data: newPTrab, error: insertError } = await supabase
        .from('p_trab')
        .insert([newPTrabData])
        .select()
        .single();
        
      if (insertError) throw insertError;
      
      // 3. Clonar registros de classes
      const cloneClassRecords = async (tableName: string) => {
        const { data: recordsToClone, error: fetchError } = await supabase
          .from(tableName as 'classe_i_registros') // Usar um tipo conhecido para o TS
          .select('*')
          .eq('p_trab_id', ptrabToClone.id);
          
        if (fetchError) {
          console.error(`Erro ao buscar registros de ${tableName}:`, fetchError);
          return;
        }
        
        if (recordsToClone && recordsToClone.length > 0) {
          const recordsToInsert = recordsToClone.map(record => {
            // Remove ID, timestamps e o p_trab_id antigo
            const { id, created_at, updated_at, p_trab_id, ...rest } = record;
            
            // Garante que o novo registro aponte para o novo PTrab
            const newRecord = { ...rest, p_trab_id: newPTrab.id };
            
            // Trata campos JSONB que podem ser nulos ou arrays
            if ('itens_equipamentos' in newRecord && newRecord.itens_equipamentos) {
                newRecord.itens_equipamentos = JSON.parse(JSON.stringify(newRecord.itens_equipamentos));
            }
            if ('itens_saude' in newRecord && newRecord.itens_saude) {
                newRecord.itens_saude = JSON.parse(JSON.stringify(newRecord.itens_saude));
            }
            if ('itens_remonta' in newRecord && newRecord.itens_remonta) {
                newRecord.itens_remonta = JSON.parse(JSON.stringify(newRecord.itens_remonta));
            }
            if ('itens_motomecanizacao' in newRecord && newRecord.itens_motomecanizacao) {
                newRecord.itens_motomecanizacao = JSON.parse(JSON.stringify(newRecord.itens_motomecanizacao));
            }
            
            return newRecord;
          });
          
          const { error: insertRecordsError } = await supabase
            .from(tableName as 'classe_i_registros')
            .insert(recordsToInsert);
            
          if (insertRecordsError) {
            console.error(`Erro ao inserir registros clonados de ${tableName}:`, insertRecordsError);
          }
        }
      };
      
      // Lista de tabelas a serem clonadas
      const tablesToClone = [
        'classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 
        'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 
        'classe_viii_saude_registros', 'classe_viii_remonta_registros', 'classe_ix_registros',
        'p_trab_ref_lpc'
      ];
      
      await Promise.all(tablesToClone.map(cloneClassRecords));
      
      toast.success(`P Trab clonado com sucesso! Novo número: ${newPTrab.numero_ptrab}`);
      queryClient.invalidateQueries({ queryKey: ['ptrabs', user?.id] });
      
    } catch (error: any) {
      toast.error(error.message || "Erro ao clonar P Trab.");
    } finally {
      setShowCloneDialog(false);
      setPtrabToClone(null);
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aberto':
        return <Badge variant="outline" className="bg-blue-100 text-blue-600 border-blue-300">Aberto</Badge>;
      case 'em_andamento':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-600 border-yellow-300">Em Andamento</Badge>;
      case 'aprovado':
        return <Badge variant="outline" className="bg-green-100 text-green-600 border-green-300">Aprovado</Badge>;
      case 'arquivado':
        return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">Arquivado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loadingSession || isLoadingPTrabs || isLoadingCredits) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando gerenciador...</span>
      </div>
    );
  }
  
  // Verifica se o usuário tem créditos definidos
  useEffect(() => {
    if (!isLoadingCredits && credits.credit_gnd3 === 0 && credits.credit_gnd4 === 0 && ptrabs.length > 0) {
      setShowCreditPrompt(true);
    }
  }, [isLoadingCredits, credits, ptrabs.length]);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container max-w-7xl mx-auto space-y-8">
        
        {/* Header e Ações */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold font-display text-foreground">Gerenciamento de Planos de Trabalho</h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/config/diretrizes')}>
              <Settings className="mr-2 h-4 w-4" />
              Diretrizes
            </Button>
            <Button variant="outline" onClick={() => navigate('/config/om')}>
              <Settings className="mr-2 h-4 w-4" />
              OMs
            </Button>
            <Button variant="outline" onClick={() => navigate('/config/ptrab-export-import')}>
              <Download className="mr-2 h-4 w-4" />
              Importar/Exportar
            </Button>
            <Button onClick={handleCreateNew} className="bg-primary hover:bg-primary-light">
              <Plus className="mr-2 h-4 w-4" />
              Novo P Trab
            </Button>
          </div>
        </div>
        
        {/* Resumo de Créditos e Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card de Créditos */}
          <Card className="md:col-span-1 shadow-lg border-2 border-accent/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-accent">
                <TrendingUp className="h-5 w-5" />
                Créditos Disponíveis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">GND 3 (Custeio)</span>
                <span className={cn("font-bold", saldoGND3 >= 0 ? "text-green-600" : "text-destructive")}>
                  {formatCurrency(saldoGND3)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">GND 4 (Permanente)</span>
                <span className={cn("font-bold", saldoGND4 >= 0 ? "text-green-600" : "text-destructive")}>
                  {formatCurrency(saldoGND4)}
                </span>
              </div>
              <Button 
                onClick={() => setShowCreditDialog(true)} 
                variant="outline" 
                className="w-full mt-2 border-accent text-accent hover:bg-accent/10 h-8 text-sm"
              >
                Informar Crédito
              </Button>
            </CardContent>
          </Card>
          
          {/* Card de Filtros e Busca */}
          <Card className="md:col-span-2 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Filtros e Busca</CardTitle>
              <CardDescription>Filtre e encontre seus Planos de Trabalho rapidamente.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="arquivado">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Buscar</label>
                <Input
                  placeholder="Buscar por número, operação ou OM..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de PTrabs */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Meus Planos de Trabalho ({filteredPTrabs.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[150px]">Nº PTrab</TableHead>
                    <TableHead>Operação / OM</TableHead>
                    <TableHead className="text-right w-[150px]">Custo Logístico</TableHead>
                    <TableHead className="text-right w-[150px]">Custo Total</TableHead>
                    <TableHead className="w-[150px]">Criado em</TableHead>
                    <TableHead className="text-right w-[150px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPTrabs.length === 0 && !isLoadingPTrabs ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Nenhum Plano de Trabalho encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPTrabs.map((ptrab) => (
                      <TableRow key={ptrab.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleEdit(ptrab)}>
                        <TableCell>{getStatusBadge(ptrab.status)}</TableCell>
                        <TableCell className="font-medium">{ptrab.numero_ptrab || 'N/A'}</TableCell>
                        <TableCell>
                          <div className="font-medium">{ptrab.nome_operacao}</div>
                          <div className="text-sm text-muted-foreground">{ptrab.nome_om}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          {ptrab.totalLogistica !== undefined ? (
                            <span className="text-orange-600 font-medium">
                              {formatCurrency(ptrab.totalLogistica)}
                            </span>
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {ptrab.totalLogistica !== undefined ? (
                            formatCurrency((ptrab.totalLogistica || 0) + (ptrab.totalOperacional || 0) + (ptrab.totalMaterialPermanente || 0) + (ptrab.totalAviacaoExercito || 0))
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(ptrab.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleViewReport(ptrab); }}>
                                  <FileText className="h-4 w-4 text-primary" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Visualizar Relatório</TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleClone(ptrab); }}>
                                  <Copy className="h-4 w-4 text-secondary" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Clonar P Trab</TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(ptrab); }} disabled={ptrab.status === 'arquivado'}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Excluir P Trab</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Diálogo de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir o P Trab "{ptrabToDelete?.numero_ptrab} - {ptrabToDelete?.nome_operacao}". Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Diálogo de Clonagem */}
      <CloneVariationDialog
        open={showCloneDialog}
        onOpenChange={setShowCloneDialog}
        ptrab={ptrabToClone}
        onConfirm={handleConfirmClone}
      />
      
      {/* Diálogo de Crédito */}
      <CreditInputDialog
        open={showCreditDialog}
        onOpenChange={setShowCreditDialog}
        totalGND3Cost={totalGND3Consolidado}
        totalGND4Cost={totalGND4Consolidado}
        initialCreditGND3={credits.credit_gnd3}
        initialCreditGND4={credits.credit_gnd4}
        onSave={handleSaveCredit}
      />
      
      {/* Diálogo de Prompt de Crédito (Aparece na primeira vez) */}
      <CreditPromptDialog
        open={showCreditPrompt}
        onOpenChange={setShowCreditPrompt}
        onOpenCreditDialog={() => {
          setShowCreditPrompt(false);
          setShowCreditDialog(true);
        }}
      />
    </div>
  );
};

export default PTrabManager;