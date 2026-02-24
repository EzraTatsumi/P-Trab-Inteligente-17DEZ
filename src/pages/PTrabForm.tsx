"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, Package, Briefcase, ArrowLeft, Calendar, Users, MapPin, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PTrabCostSummary, fetchPTrabTotals } from "@/components/PTrabCostSummary";
import { CreditInputDialog } from "@/components/CreditInputDialog";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchUserCredits, updateUserCredits } from "@/lib/creditUtils";
import { CreditPromptDialog } from "@/components/CreditPromptDialog";
import PageMetadata from "@/components/PageMetadata";
import { GHOST_DATA, isGhostMode } from "@/lib/ghostStore";
import { runMission03, runMission04 } from "@/tours/missionTours";

interface PTrabData {
  numero_ptrab: string;
  comando_militar_area: string;
  nome_om: string;
  nome_operacao: string;
  periodo_inicio: string;
  periodo_fim: string;
  efetivo_empregado: string;
  acoes: string;
  status: string;
  nome_cmt_om?: string;
  local_om?: string;
}

const PTrabForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const { user, isLoading: loadingSession } = useSession();
  const queryClient = useQueryClient();
  
  const [ptrabData, setPtrabData] = useState<PTrabData | null>(null);
  const [selectedTab, setSelectedTab] = useState("logistica");
  const [loadingPTrab, setLoadingPTrab] = useState(true);
  
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [hasPromptedForCredit, setHasPromptedForCredit] = useState(false);

  // Expondo a troca de aba para o Tour
  useEffect(() => {
    (window as any).setTabOperacional = () => setSelectedTab("operacional");
    (window as any).setTabLogistica = () => setSelectedTab("logistica");
    
    return () => {
      delete (window as any).setTabOperacional;
      delete (window as any).setTabLogistica;
    };
  }, []);

  const classesLogistica = [
    { id: "classe-i", name: "Classe I - Subsistência" },
    { id: "classe-ii", name: "Classe II - Material de Intendência" },
    { id: "classe-iii", name: "Classe III - Combustíveis e Lubrificantes" },
    { id: "classe-v", name: "Classe V - Armamento" },
    { id: "classe-vi", name: "Classe VI - Material de Engenharia" },
    { id: "classe-vii", name: "Classe VII - Comunicações e Informática" },
    { id: "classe-viii", name: "Classe VIII - Material de Saúde e Remonta/Veterinária" },
    { id: "classe-ix", name: "Classe IX - Material de Manutenção" },
  ];

  const itensOperacional = [
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

  const { data: credits, isLoading: isLoadingCredits } = useQuery({
    queryKey: ['userCredits', user?.id],
    queryFn: () => fetchUserCredits(user!.id),
    enabled: !!user?.id,
    initialData: { credit_gnd3: 0, credit_gnd4: 0 },
  });
  
  const { data: totals, isLoading: isLoadingTotals } = useQuery({
    queryKey: ['ptrabTotals', ptrabId],
    queryFn: () => fetchPTrabTotals(ptrabId!), // Unificado: fetchPTrabTotals agora lida com Ghost Mode
    enabled: !!ptrabId || isGhostMode(),
    refetchInterval: 10000,
    initialData: {
      totalLogisticoGeral: 0,
      totalOperacional: 0,
      totalMaterialPermanente: 0,
      totalAviacaoExercito: 0,
      totalClasseI: 0,
      totalClasseII: 0,
      totalClasseV: 0,
      totalCombustivel: 0,
      totalLubrificanteValor: 0,
    } as any,
  });
  
  const saveCreditsMutation = useMutation({
    mutationFn: ({ gnd3, gnd4 }: { gnd3: number, gnd4: number }) => 
      updateUserCredits(user!.id, gnd3, gnd4),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
      queryClient.invalidateQueries({ queryKey: ['userCredits', user?.id] });
      toast.success("Créditos disponíveis atualizados e salvos!");
    },
    onError: (error) => {
      toast.error(error.message || "Falha ao salvar créditos.");
    }
  });

  useEffect(() => {
    const loadPTrab = async () => {
      if (isGhostMode()) {
        setPtrabData(GHOST_DATA.p_trab_exemplo);
        setLoadingPTrab(false);
        return;
      }

      if (!ptrabId) {
        toast.error("P Trab não selecionado");
        navigate('/ptrab');
        return;
      }

      const { data, error } = await supabase
        .from('p_trab')
        .select('*')
        .eq('id', ptrabId)
        .single();

      if (error || !data) {
        toast.error("Não foi possível carregar o P Trab");
        navigate('/ptrab');
        return;
      }

      setPtrabData({
        ...data,
        efetivo_empregado: String(data.efetivo_empregado),
      });
      setLoadingPTrab(false);
    };

    loadPTrab();
  }, [ptrabId, navigate, searchParams]);

  // Lógica do Tour - Sincronizada com o carregamento
  useEffect(() => {
    if (loadingPTrab || isLoadingTotals || isLoadingCredits) return;

    const startTour = searchParams.get('startTour') === 'true';
    const missionId = localStorage.getItem('active_mission_id');
    const ghost = isGhostMode();

    if (startTour && ghost) {
      const timer = setTimeout(() => {
        if (missionId === '3') {
          runMission03(() => {
            const completed = JSON.parse(localStorage.getItem('completed_missions') || '[]');
            if (!completed.includes(3)) {
              localStorage.setItem('completed_missions', JSON.stringify([...completed, 3]));
            }
            navigate('/ptrab?showHub=true');
          });
        } else if (missionId === '4') {
          runMission04(() => {
            const completed = JSON.parse(localStorage.getItem('completed_missions') || '[]');
            if (!completed.includes(4)) {
              localStorage.setItem('completed_missions', JSON.stringify([...completed, 4]));
            }
            navigate('/ptrab?showHub=true');
          });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loadingPTrab, isLoadingTotals, isLoadingCredits, searchParams, navigate]);
  
  useEffect(() => {
    if (!loadingSession && !loadingPTrab && !isLoadingCredits && ptrabData && credits && !hasPromptedForCredit) {
      const isPTrabOpen = ptrabData.status === 'aberto';
      const hasZeroCredits = credits.credit_gnd3 === 0 && credits.credit_gnd4 === 0;

      if (isPTrabOpen && hasZeroCredits && !isGhostMode()) {
        setShowCreditDialog(true);
        setHasPromptedForCredit(true);
      }
    }
  }, [loadingSession, loadingPTrab, isLoadingCredits, ptrabData, credits, hasPromptedForCredit]);

  const calculatedGND3 = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito;
  const calculatedGND4 = totals.totalMaterialPermanente;

  const handleSaveCredit = (gnd3: number, gnd4: number) => {
    if (!user?.id) {
      toast.error("Erro: Usuário não identificado para salvar créditos.");
      return;
    }
    saveCreditsMutation.mutate({ gnd3, gnd4 });
  };
  
  const handleItemClick = (itemId: string, itemName: string, type: string) => {
    if (ptrabData?.status === 'completo' || ptrabData?.status === 'arquivado') {
      toast.warning("Este P Trab está completo ou arquivado e não pode ser editado.");
      return;
    }
    
    if (itemId === 'classe-i') {
      navigate(`/ptrab/classe-i?ptrabId=${ptrabId}`);
    } else if (itemId === 'classe-ii') {
      navigate(`/ptrab/classe-ii?ptrabId=${ptrabId}`);
    } else if (itemId === 'classe-iii') {
      navigate(`/ptrab/classe-iii?ptrabId=${ptrabId}`);
    } else if (itemId === 'classe-v') {
      navigate(`/ptrab/classe-v?ptrabId=${ptrabId}`);
    } else if (itemId === 'classe-vi') {
      navigate(`/ptrab/classe-vi?ptrabId=${ptrabId}`);
    } else if (itemId === 'classe-vii') {
      navigate(`/ptrab/classe-vii?ptrabId=${ptrabId}`);
    } else if (itemId === 'classe-viii') {
      navigate(`/ptrab/classe-viii?ptrabId=${ptrabId}`);
    } else if (itemId === 'classe-ix') {
      navigate(`/ptrab/classe-ix?ptrabId=${ptrabId}`);
    } else if (itemId === 'diaria') {
      navigate(`/ptrab/diaria?ptrabId=${ptrabId}`);
    } else if (itemId === 'verba-operacional') {
      navigate(`/ptrab/verba-operacional?ptrabId=${ptrabId}`);
    } else if (itemId === 'suprimento-fundos') {
      navigate(`/ptrab/suprimento-fundos?ptrabId=${ptrabId}`);
    } else if (itemId === 'passagem-aerea') {
      navigate(`/ptrab/passagem-aerea?ptrabId=${ptrabId}`);
    } else if (itemId === 'horas-voo-avex') {
      navigate(`/ptrab/horas-voo-avex?ptrabId=${ptrabId}`);
    } else if (itemId === 'concessionaria') {
      navigate(`/ptrab/concessionaria?ptrabId=${ptrabId}`);
    } else if (itemId === 'material-consumo') {
      navigate(`/ptrab/material-consumo?ptrabId=${ptrabId}`);
    } else if (itemId === 'material-permanente') {
      navigate(`/ptrab/material-permanente?ptrabId=${ptrabId}`);
    } else if (itemId === 'complemento-alimentacao') {
      navigate(`/ptrab/complemento-alimentacao?ptrabId=${ptrabId}`);
    } else if (itemId === 'servicos-terceiros') {
      navigate(`/ptrab/servicos-terceiros?ptrabId=${ptrabId}`);
    } else {
      toast.info(`Funcionalidade '${itemName}' (Operacional) ainda não implementada.`);
    }
  };

  const pageTitle = ptrabData?.numero_ptrab && ptrabData?.nome_operacao 
    ? `${ptrabData.numero_ptrab} - ${ptrabData.nome_operacao}` 
    : "Preenchimento do P Trab";

  if (loadingSession || loadingPTrab || isLoadingCredits || isLoadingTotals) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const calculateDays = (inicio: string, fim: string) => {
    const start = new Date(inicio);
    const end = new Date(fim);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
  };

  return (
    <div className="min-h-screen bg-background py-4 px-4">
      <PageMetadata 
        title={pageTitle} 
        description={`Preenchimento e detalhamento de custos para o Plano de Trabalho ${ptrabData?.numero_ptrab} - ${ptrabData?.nome_operacao}.`}
        canonicalPath={`/ptrab/form?ptrabId=${ptrabId}`}
      />
      
      <div className="container max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/ptrab')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Gerenciamento
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card className="shadow-lg">
              <CardHeader className="pb-1 pt-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <FileText className="h-5 w-5 text-primary" />
                  Dados do P Trab
                </h2>
              </CardHeader>
              <CardContent className="pt-2 pb-3">
                <div className="grid grid-cols-2 gap-y-1 gap-x-4">
                  <div className="space-y-0.5">
                    <Label className="text-muted-foreground text-xs">Número do PTrab</Label>
                    <p className="text-sm font-medium">{ptrabData?.numero_ptrab}</p>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-muted-foreground text-xs">Nome da Operação</Label>
                    <p className="font-medium text-xs">{ptrabData?.nome_operacao}</p>
                  </div>
                  <div className="space-y-0.5 col-span-2">
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Período
                    </Label>
                    <p className="text-sm font-medium">
                      {ptrabData && 
                        `${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - ${calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim)} dias`
                      }
                    </p>
                  </div>
                  <div className="space-y-0.5 col-span-2">
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Efetivo Empregado
                    </Label>
                    <p className="text-sm font-medium">{ptrabData?.efetivo_empregado}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {ptrabId && (
              <PTrabCostSummary 
                ptrabId={ptrabId} 
                onOpenCreditDialog={() => setShowCreditDialog(true)}
                creditGND3={isGhostMode() ? GHOST_DATA.totais_exemplo.credit_gnd3 : credits.credit_gnd3}
                creditGND4={isGhostMode() ? GHOST_DATA.totais_exemplo.credit_gnd4 : credits.credit_gnd4}
              />
            )}
          </div>

          <div className="lg:col-span-2 card-selecao-material">
            <Card className="shadow-lg">
              <CardHeader>
                <h2 className="text-xl font-bold">Selecione o Tipo de Material</h2>
                <CardDescription>
                  Escolha entre logística ou operacional
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="logistica" className="flex items-center gap-2 tabs-logistica">
                      <Package className="h-4 w-4" />
                      Aba Logística
                    </TabsTrigger>
                    <TabsTrigger value="operacional" className="flex items-center gap-2 tabs-operacional">
                      <Briefcase className="h-4 w-4" />
                      Aba Operacional
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="logistica" className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      Selecione a Classe de Material
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {classesLogistica.map((classe) => (
                        <Button
                          key={classe.id}
                          variant="outline"
                          className="h-auto py-4 px-6 justify-start text-left hover:bg-primary/10 hover:border-primary transition-all"
                          onClick={() => handleItemClick(classe.id, classe.name, "logistica")}
                          disabled={ptrabData?.status === 'completo' || ptrabData?.status === 'arquivado'}
                        >
                          <div>
                            <div className="font-semibold">{classe.name.split(" - ")[0]}</div>
                            <div className="text-sm text-muted-foreground">
                              {classe.id === 'classe-ix' ? 'Motomecanização' : classe.name.split(" - ")[1]}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="operacional" className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      Selecione o Item Operacional
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {itensOperacional.map((item) => (
                        <Button
                          key={item.id}
                          variant="outline"
                          className={`h-auto py-4 px-6 justify-start text-left hover:bg-primary/10 hover:border-primary transition-all ${item.id === 'material-consumo' ? 'btn-material-consumo' : ''}`}
                          onClick={() => handleItemClick(item.id, item.name, "operacional")}
                          disabled={ptrabData?.status === 'completo' || ptrabData?.status === 'arquivado'}
                        >
                          <div className="font-semibold">{item.name}</div>
                        </Button>
                      ))}
                    </div>
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
        totalGND3Cost={calculatedGND3}
        totalGND4Cost={calculatedGND4}
        initialCreditGND3={credits.credit_gnd3}
        initialCreditGND4={credits.credit_gnd4}
        onSave={handleSaveCredit}
      />
    </div>
  );
};

export default PTrabForm;