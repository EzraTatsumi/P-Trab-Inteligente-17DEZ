import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, Package, Briefcase, ArrowLeft, Calendar, Users, MapPin, Loader2, RefreshCw, DollarSign, TrendingUp, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PTrabCostSummary, fetchPTrabTotals } from "@/components/PTrabCostSummary";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchUserCredits, updateUserCredits } from "@/lib/creditUtils";
import { CreditPromptDialog } from "@/components/CreditPromptDialog";
import { formatCurrency } from "@/lib/formatUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useFormNavigation } from "@/hooks/useFormNavigation";

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

// --- Lógica de Input de Crédito (Movida para o arquivo) ---

// Função auxiliar para formatar o número para exibição no input (usando vírgula)
const formatNumberForInput = (num: number): string => {
  if (num === 0) return "";
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

// Função para limpar e formatar a string de entrada com separadores de milhar
const formatInputWithThousands = (value: string): string => {
  let cleaned = String(value || '').replace(/[^\d,.]/g, '');
  const decimalIndex = cleaned.indexOf(',');
  if (decimalIndex !== -1) {
    const integerPart = cleaned.substring(0, decimalIndex).replace(/\./g, '');
    let decimalPart = cleaned.substring(decimalIndex + 1).replace(/,/g, '');
    decimalPart = decimalPart.substring(0, 2);
    cleaned = `${integerPart}${decimalPart ? `,${decimalPart}` : ''}`;
  } else {
    cleaned = cleaned.replace(/\./g, '');
  }
  const parts = cleaned.split(',');
  let integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.length > 1 ? `${integerPart},${parts[1]}` : integerPart;
};

const parseInputToNumber = (input: string): number => {
  const cleaned = input.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

const CreditInputDialog = ({
  open,
  onOpenChange,
  totalGND3Cost,
  totalGND4Cost,
  initialCreditGND3,
  initialCreditGND4,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalGND3Cost: number;
  totalGND4Cost: number;
  initialCreditGND3: number;
  initialCreditGND4: number;
  onSave: (gnd3: number, gnd4: number) => void;
}) => {
  const [inputGND3, setInputGND3] = useState<string>(formatNumberForInput(initialCreditGND3));
  const [inputGND4, setInputGND4] = useState<string>(formatNumberForInput(initialCreditGND4));
  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    if (open) {
      setInputGND3(formatNumberForInput(initialCreditGND3));
      setInputGND4(formatNumberForInput(initialCreditGND4));
    }
  }, [open, initialCreditGND3, initialCreditGND4]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, setInput: React.Dispatch<React.SetStateAction<string>>) => {
    const rawValue = e.target.value;
    const formattedValue = formatInputWithThousands(rawValue);
    setInput(formattedValue);
  };
  
  const handleInputBlur = (input: string, setInput: React.Dispatch<React.SetStateAction<string>>) => {
    const numericValue = parseInputToNumber(input);
    setInput(formatNumberForInput(numericValue));
  };

  const handleSave = () => {
    const finalGND3 = parseInputToNumber(inputGND3);
    const finalGND4 = parseInputToNumber(inputGND4);
    onSave(finalGND3, finalGND4);
    onOpenChange(false);
  };

  const currentCreditGND3 = parseInputToNumber(inputGND3);
  const currentCreditGND4 = parseInputToNumber(inputGND4);
  
  const saldoGND3 = currentCreditGND3 - totalGND3Cost;
  const saldoGND4 = currentCreditGND4 - totalGND4Cost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-accent">
            <TrendingUp className="h-5 w-5" />
            Informar Crédito Disponível
          </DialogTitle>
          <DialogDescription>
            Insira os valores orçamentários disponíveis para GND 3 e GND 4.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          
          {/* GND 3 - Custeio (Logística, Operacional, Aviação) */}
          <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
            <Label htmlFor="credit-gnd3" className="font-semibold text-sm">GND 3 - Custeio</Label>
            <div className="relative">
              <Input
                id="credit-gnd3"
                type="text"
                inputMode="decimal"
                value={inputGND3}
                onChange={(e) => handleInputChange(e, setInputGND3)}
                onBlur={() => handleInputBlur(inputGND3, setInputGND3)}
                placeholder="0,00"
                className="pl-12 text-lg"
                onKeyDown={handleEnterToNextField}
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-foreground">R$</span>
            </div>
            
            <div className="flex justify-between text-xs pt-1">
              <span className="text-muted-foreground">Custo Calculado:</span>
              <span className="font-medium text-foreground">{formatCurrency(totalGND3Cost)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t pt-2">
              <span className="text-foreground">SALDO:</span>
              <span className={saldoGND3 >= 0 ? "text-green-600" : "text-destructive"}>
                {formatCurrency(saldoGND3)}
              </span>
            </div>
          </div>

          {/* GND 4 - Material Permanente */}
          <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
            <Label htmlFor="credit-gnd4" className="font-semibold text-sm">GND 4 - Investimento (Material Permanente)</Label>
            <div className="relative">
              <Input
                id="credit-gnd4"
                type="text"
                inputMode="decimal"
                value={inputGND4}
                onChange={(e) => handleInputChange(e, setInputGND4)}
                onBlur={() => handleInputBlur(inputGND4, setInputGND4)}
                placeholder="0,00"
                className="pl-12 text-lg"
                onKeyDown={handleEnterToNextField}
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-foreground">R$</span>
            </div>
            
            <div className="flex justify-between text-xs pt-1">
              <span className="text-muted-foreground">Custo Calculado:</span>
              <span className="font-medium text-foreground">{formatCurrency(totalGND4Cost)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t pt-2">
              <span className="text-foreground">SALDO:</span>
              <span className={saldoGND4 >= 0 ? "text-green-600" : "text-destructive"}>
                {formatCurrency(saldoGND4)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Créditos
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
// --- Fim Lógica de Input de Crédito ---


const PTrabForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const { user, loading: loadingSession } = useSession();
  const queryClient = useQueryClient();
  
  const [ptrabData, setPtrabData] = useState<PTrabData | null>(null);
  const [selectedTab, setSelectedTab] = useState("logistica");
  const [loadingPTrab, setLoadingPTrab] = useState(true);
  
  // NOVOS ESTADOS PARA CRÉDITO E DIÁLOGO
  const [showCreditDialog, setShowCreditDialog] = useState(false);

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
    { id: "locacao-viatura", name: "Locação de Viatura" },
    { id: "locacao-estruturas", name: "Locação de Estruturas" },
    { id: "servico-grafico", name: "Serviço Gráfico" },
    { id: "passagem-aerea", name: "Passagem Aérea" },
    { id: "diaria", name: "Diária" },
    { id: "outros", name: "Outros" },
  ];

  // --- Lógica de Busca de Créditos (TanStack Query) ---
  const { data: credits, isLoading: isLoadingCredits } = useQuery({
    queryKey: ['userCredits', user?.id],
    queryFn: () => fetchUserCredits(user!.id),
    enabled: !!user?.id,
    initialData: { credit_gnd3: 0, credit_gnd4: 0 },
  });
  
  // --- Lógica de Busca de Totais (TanStack Query) ---
  const { data: totals, isLoading: isLoadingTotals } = useQuery({
    queryKey: ['ptrabTotals', ptrabId],
    queryFn: () => fetchPTrabTotals(ptrabId!),
    enabled: !!ptrabId,
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
  
  // --- Lógica de Mutação para Salvar Créditos ---
  const saveCreditsMutation = useMutation({
    mutationFn: ({ gnd3, gnd4 }: { gnd3: number, gnd4: number }) => 
      updateUserCredits(user!.id, gnd3, gnd4),
    onSuccess: () => {
      // Invalida as queries para forçar a atualização dos totais e créditos
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
      
      const shouldOpenCreditDialog = searchParams.get('openCredit') === 'true';
      if (shouldOpenCreditDialog) {
        setShowCreditDialog(true);
        searchParams.delete('openCredit');
        navigate(`?${searchParams.toString()}`, { replace: true });
      }
    };

    loadPTrab();
  }, [ptrabId, navigate, searchParams]);

  // Calculate costs based on query data
  const calculatedGND3 = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito;
  const calculatedGND4 = totals.totalMaterialPermanente;

  const handleSaveCredit = (gnd3: number, gnd4: number) => {
    if (!user?.id) {
      toast.error("Erro: Usuário não identificado para salvar créditos.");
      return;
    }
    saveCreditsMutation.mutate({ gnd3, gnd4 });
  };
  
  const handleItemClick = (itemId: string, type: string) => {
    if (ptrabData?.status === 'completo' || ptrabData?.status === 'arquivado') {
      toast.warning("Este P Trab está completo ou arquivado e não pode ser editado.");
      return;
    }
    
    if (itemId === 'classe-i') {
      navigate(`/ptrab/classe-i?ptrabId=${ptrabId}`);
    } else if (itemId === 'classe-iii') {
      navigate(`/ptrab/classe-iii?ptrabId=${ptrabId}`);
    } else if (['classe-ii', 'classe-v', 'classe-vi', 'classe-vii', 'classe-viii', 'classe-ix'].includes(itemId)) {
      // Redireciona todas as classes de material (exceto I e III) para a rota da Classe IX
      navigate(`/ptrab/classe-ix?ptrabId=${ptrabId}`);
    } else {
      console.log(`Selecionado: ${itemId} do tipo ${type}`);
    }
  };

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
          {/* Coluna Esquerda: Dados do P Trab, Resumo de Custos e Crédito Disponível */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="shadow-lg">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Dados do P Trab
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2 pb-3">
                <div className="grid grid-cols-2 gap-y-1 gap-x-4">
                  <div className="space-y-0.5">
                    <Label className="text-muted-foreground text-xs">Número do PTrab</Label>
                    <p className="text-sm font-medium">{ptrabData?.numero_ptrab}</p>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-muted-foreground text-xs">Nome da Operação</Label>
                    <p className="text-sm font-medium">{ptrabData?.nome_operacao}</p>
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
            
            {/* Resumo de Custos */}
            {ptrabId && (
              <PTrabCostSummary 
                ptrabId={ptrabId} 
                onOpenCreditDialog={() => setShowCreditDialog(true)}
                creditGND3={credits.credit_gnd3}
                creditGND4={credits.credit_gnd4}
              />
            )}
            
          </div>

          {/* Coluna Direita: Seleção de Classes/Itens */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Selecione o Tipo de Material</CardTitle>
                <CardDescription>
                  Escolha entre logística ou operacional
                </CardDescription>
              </CardHeader>
              <CardContent>

                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="logistica" className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Aba Logística
                    </TabsTrigger>
                    <TabsTrigger value="operacional" className="flex items-center gap-2">
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
                          onClick={() => handleItemClick(classe.id, "logistica")}
                          disabled={ptrabData?.status === 'completo' || ptrabData?.status === 'arquivado'}
                        >
                          <div>
                            <div className="font-semibold">{classe.name.split(" - ")[0]}</div>
                            <div className="text-sm text-muted-foreground">
                              {classe.name.split(" - ")[1]}
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
                          className="h-auto py-4 px-6 justify-start text-left hover:bg-secondary/10 hover:border-secondary transition-all"
                          onClick={() => handleItemClick(item.id, "operacional")}
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
      
      {/* Diálogo de Crédito (Movido para dentro do arquivo) */}
      <CreditInputDialog
        open={showCreditDialog}
        onOpenChange={setShowCreditDialog}
        totalGND3Cost={calculatedGND3}
        totalGND4Cost={calculatedGND4}
        initialCreditGND3={credits.credit_gnd3}
        initialCreditGND4={credits.credit_gnd4}
        onSave={handleSaveCredit}
      />
      
      {/* Diálogo de Prompt de Crédito */}
      {/* Removido CreditPromptDialog */}
    </div>
  );
};

export default PTrabForm;