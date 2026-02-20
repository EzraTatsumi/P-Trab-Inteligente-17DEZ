"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, Package, Briefcase, ArrowLeft, Calendar, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PTrabCostSummary, fetchPTrabTotals } from "@/components/PTrabCostSummary";
import { CreditInputDialog } from "@/components/CreditInputDialog";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchUserCredits, updateUserCredits } from "@/lib/creditUtils";
import PageMetadata from "@/components/PageMetadata";

// 1. Constantes movidas para fora para evitar recriação em cada render
const CLASSES_LOGISTICA = [
  { id: "classe-i", name: "Classe I", sub: "Subsistência" },
  { id: "classe-ii", name: "Classe II", sub: "Material de Intendência" },
  { id: "classe-iii", name: "Classe III", sub: "Combustíveis e Lubrificantes" },
  { id: "classe-v", name: "Classe V", sub: "Armamento" },
  { id: "classe-vi", name: "Classe VI", sub: "Material de Engenharia" },
  { id: "classe-vii", name: "Classe VII", sub: "Comunicações e Informática" },
  { id: "classe-viii", name: "Classe VIII", sub: "Material de Saúde/Remonta" },
  { id: "classe-ix", name: "Classe IX", sub: "Motomecanização" },
];

const ITENS_OPERACIONAL = [
  { id: "complemento-alimentacao", name: "Complemento de Alimentação" },
  { id: "horas-voo-avex", name: "Horas de Voo (AvEx)" },
  { id: "material-consumo", name: "Material de Consumo" },
  { id: "material-permanente", name: "Material Permanente" },
  { id: "servicos-terceiros", name: "Serviço de Terceiros/Locações" },
  { id: "concessionaria", name: "Pagamento de Concessionárias" },
  { id: "diaria", name: "Pagamento de Diárias" },
  { id: "passagem-aerea", name: "Passagens" },
  { id: "suprimento-fundos", name: "Suprimento de Fundos" },
  { id: "verba-operacional", name: "Verba Operacional" },
];

const PTrabForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const { user, isLoading: loadingSession } = useSession();
  const queryClient = useQueryClient();
  
  const [selectedTab, setSelectedTab] = useState("logistica");
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [hasPromptedForCredit, setHasPromptedForCredit] = useState(false);

  // 2. Query para carregar os dados do P Trab (Substitui o useEffect manual)
  const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery({
    queryKey: ['p_trab_data', ptrabId],
    queryFn: async () => {
      if (!ptrabId) return null;
      const { data, error } = await supabase
        .from('p_trab')
        .select('*')
        .eq('id', ptrabId)
        .single();
      if (error) throw error;
      return { ...data, efetivo_empregado: String(data.efetivo_empregado) };
    },
    enabled: !!ptrabId,
    staleTime: 1000 * 60 * 5, // Cache de 5 min
  });

  // 3. Queries paralelas (executam junto com a de cima)
  const { data: credits, isLoading: isLoadingCredits } = useQuery({
    queryKey: ['userCredits', user?.id],
    queryFn: () => fetchUserCredits(user!.id),
    enabled: !!user?.id,
    initialData: { credit_gnd3: 0, credit_gnd4: 0 },
  });
  
  const { data: totals, isLoading: isLoadingTotals } = useQuery({
    queryKey: ['ptrabTotals', ptrabId],
    queryFn: () => fetchPTrabTotals(ptrabId!),
    enabled: !!ptrabId,
    refetchInterval: 30000, // Aumentado para 30s para economizar recursos
  });

  const saveCreditsMutation = useMutation({
    mutationFn: ({ gnd3, gnd4 }: { gnd3: number, gnd4: number }) => 
      updateUserCredits(user!.id, gnd3, gnd4),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
      queryClient.invalidateQueries({ queryKey: ['userCredits', user?.id] });
      toast.success("Créditos disponíveis atualizados e salvos!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Falha ao salvar créditos.");
    }
  });

  // 4. Lógica de prompt de crédito otimizada
  useEffect(() => {
    if (ptrabData && credits && !hasPromptedForCredit) {
      const isPTrabOpen = ptrabData.status === 'aberto';
      const hasZeroCredits = credits.credit_gnd3 === 0 && credits.credit_gnd4 === 0;

      if (isPTrabOpen && hasZeroCredits) {
        setShowCreditDialog(true);
        setHasPromptedForCredit(true);
      }
    }
  }, [ptrabData, credits, hasPromptedForCredit]);

  // 5. Cálculos memoizados
  const calculatedTotals = useMemo(() => {
    if (!totals) return { gnd3: 0, gnd4: 0 };
    return {
      gnd3: (totals.totalLogisticoGeral || 0) + (totals.totalOperacional || 0) + (totals.totalAviacaoExercito || 0),
      gnd4: totals.totalMaterialPermanente || 0
    };
  }, [totals]);

  // 6. Funções utilitárias memoizadas
  const formatDate = useCallback((date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  }, []);

  const calculateDays = useCallback((inicio: string, fim: string) => {
    const start = new Date(inicio);
    const end = new Date(fim);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
  }, []);

  const handleItemClick = (itemId: string) => {
    if (ptrabData?.status === 'completo' || ptrabData?.status === 'arquivado') {
      toast.warning("Este P Trab está completo ou arquivado e não pode ser editado.");
      return;
    }
    // Navegação simplificada
    navigate(`/ptrab/${itemId}?ptrabId=${ptrabId}`);
  };

  const handleSaveCredit = (gnd3: number, gnd4: number) => {
    if (!user?.id) {
      toast.error("Erro: Usuário não identificado para salvar créditos.");
      return;
    }
    saveCreditsMutation.mutate({ gnd3, gnd4 });
  };

  const isDataLoading = loadingSession || isLoadingPTrab || isLoadingCredits || isLoadingTotals;

  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Sincronizando dados...</span>
      </div>
    );
  }

  const pageTitle = ptrabData?.numero_ptrab && ptrabData?.nome_operacao 
    ? `${ptrabData.numero_ptrab} - ${ptrabData.nome_operacao}` 
    : "Preenchimento do P Trab";

  return (
    <div className="min-h-screen bg-background py-4 px-4">
      <PageMetadata 
        title={pageTitle} 
        description="Detalhamento de custos operacionais e logísticos."
        canonicalPath={`/ptrab/form?ptrabId=${ptrabId}`}
      />
      
      <div className="container max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => navigate('/ptrab')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Gerenciamento
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Lateral: Dados do P Trab */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="shadow-md border-primary/10">
              <CardHeader className="pb-2 pt-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <FileText className="h-5 w-5 text-primary" />
                  Dados do P Trab
                </h2>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-muted-foreground text-[10px] uppercase">Número</Label>
                    <p className="text-sm font-bold">{ptrabData?.numero_ptrab}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-[10px] uppercase">Operação</Label>
                    <p className="text-sm font-bold truncate">{ptrabData?.nome_operacao}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-[10px] uppercase">Período</Label>
                  <p className="text-sm font-medium">
                    {ptrabData && `${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} (${calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim)} dias)`}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-[10px] uppercase font-semibold">Efetivo</Label>
                  <p className="text-sm font-medium">{ptrabData?.efetivo_empregado} militares</p>
                </div>
              </CardContent>
            </Card>
            
            {ptrabId && (
              <PTrabCostSummary 
                ptrabId={ptrabId} 
                onOpenCreditDialog={() => setShowCreditDialog(true)}
                creditGND3={credits.credit_gnd3}
                creditGND4={credits.credit_gnd4}
              />
            )}
          </div>

          {/* Coluna Principal: Abas de Seleção */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader>
                <h2 className="text-xl font-bold">Detalhamento de Custos</h2>
                <CardDescription>Selecione a categoria para adicionar itens</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                  <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
                    <TabsTrigger value="logistica" className="gap-2 text-sm">
                      <Package className="h-4 w-4" /> Logística
                    </TabsTrigger>
                    <TabsTrigger value="operacional" className="gap-2 text-sm">
                      <Briefcase className="h-4 w-4" /> Operacional
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="logistica" className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {CLASSES_LOGISTICA.map((classe) => (
                      <Button
                        key={classe.id}
                        variant="outline"
                        className="h-auto py-4 px-5 justify-start hover:bg-primary/5 hover:border-primary/50 transition-all border-muted"
                        onClick={() => handleItemClick(classe.id)}
                        disabled={ptrabData?.status === 'completo' || ptrabData?.status === 'arquivado'}
                      >
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-primary">{classe.name}</span>
                          <span className="text-xs text-muted-foreground">{classe.sub}</span>
                        </div>
                      </Button>
                    ))}
                  </TabsContent>

                  <TabsContent value="operacional" className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ITENS_OPERACIONAL.map((item) => (
                      <Button
                        key={item.id}
                        variant="outline"
                        className="h-auto py-4 px-5 justify-start hover:bg-primary/5 hover:border-primary/50 transition-all border-muted"
                        onClick={() => handleItemClick(item.id)}
                        disabled={ptrabData?.status === 'completo' || ptrabData?.status === 'arquivado'}
                      >
                        <span className="font-semibold">{item.name}</span>
                      </Button>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <CreditInputDialog
        open={showCreditDialog}
        onOpenChange={setShowCreditDialog}
        totalGND3Cost={calculatedTotals.gnd3}
        totalGND4Cost={calculatedTotals.gnd4}
        initialCreditGND3={credits.credit_gnd3}
        initialCreditGND4={credits.credit_gnd4}
        onSave={handleSaveCredit}
      />
    </div>
  );
};

export default PTrabForm;