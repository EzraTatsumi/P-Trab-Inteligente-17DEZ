import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, Package, Briefcase, ArrowLeft, Calendar, Users, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PTrabCostSummary } from "@/components/PTrabCostSummary";
import { CreditInputCard } from "@/components/CreditInputCard"; // Importar o novo componente

interface PTrabData {
  numero_ptrab: string;
  comando_militar_area: string;
  nome_om: string;
  nome_operacao: string;
  periodo_inicio: string;
  periodo_fim: string;
  efetivo_empregado: string; // Alterado de number para string
  acoes: string;
  status: string;
  nome_cmt_om?: string;
  local_om?: string;
}

const PTrabForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const ptrabId = searchParams.get('ptrabId');
  const [ptrabData, setPtrabData] = useState<PTrabData | null>(null);
  const [selectedTab, setSelectedTab] = useState("logistica");
  const [loading, setLoading] = useState(true);
  
  // Novos estados para armazenar os custos totais (para passar ao CreditInputCard)
  const [totalGND3Cost, setTotalGND3Cost] = useState(0);
  const [totalGND4Cost, setTotalGND4Cost] = useState(0);

  const classesLogistica = [
    { id: "classe-i", name: "Classe I - Subsistência" },
    { id: "classe-ii", name: "Classe II - Material de Intendência" },
    { id: "classe-iii", name: "Classe III - Combustíveis e Lubrificantes" },
    { id: "classe-iv", name: "Classe IV - Material de Construção" },
    { id: "classe-v", name: "Classe V - Munição" },
    { id: "classe-vi", name: "Classe VI - Material de Engenharia" },
    { id: "classe-vii", name: "Classe VII - Viaturas e Equipamentos" },
    { id: "classe-viii", name: "Classe VIII - Material de Saúde" },
    { id: "classe-ix", name: "Classe IX - Material de Manutenção" },
    { id: "classe-x", name: "Classe X - Material para Atividades Especiais" },
  ];

  const itensOperacional = [
    { id: "locacao-viatura", name: "Locação de Viatura" },
    { id: "locacao-estruturas", name: "Locação de Estruturas" },
    { id: "servico-grafico", name: "Serviço Gráfico" },
    { id: "passagem-aerea", name: "Passagem Aérea" },
    { id: "diaria", name: "Diária" },
    { id: "outros", name: "Outros" },
  ];

  useEffect(() => {
    const loadPTrab = async () => {
      if (!ptrabId) {
        toast({
          title: "Erro",
          description: "P Trab não selecionado",
          variant: "destructive",
        });
        navigate('/ptrab');
        return;
      }

      const { data, error } = await supabase
        .from('p_trab')
        .select('*')
        .eq('id', ptrabId)
        .single();

      if (error || !data) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar o P Trab",
          variant: "destructive",
        });
        navigate('/ptrab');
        return;
      }

      setPtrabData({
        ...data,
        efetivo_empregado: String(data.efetivo_empregado), // Garante que seja string ao carregar
      });
      setLoading(false);
    };

    loadPTrab();
  }, [ptrabId, navigate, toast]);

  // Função para buscar os totais e atualizar os estados de custo
  const fetchAndSetTotals = async () => {
    if (!ptrabId) return;
    
    // Esta lógica deve ser implementada no futuro, por enquanto, usamos 0
    // Para simular, vamos usar os valores do PTrabManager (que já calcula Logística)
    // Mas como não temos acesso direto ao PTrabManager, vamos simular a busca aqui
    
    // Simulação de busca de totais (usando a mesma lógica do PTrabCostSummary)
    const { data: classeIData } = await supabase
      .from('classe_i_registros')
      .select('total_qs, total_qr')
      .eq('p_trab_id', ptrabId);

    const totalClasseI = (classeIData || []).reduce((sum, record) => sum + record.total_qs + record.total_qr, 0);

    const { data: classeIIIData } = await supabase
      .from('classe_iii_registros')
      .select('valor_total')
      .eq('p_trab_id', ptrabId);

    const totalClasseIII = (classeIIIData || []).reduce((sum, record) => sum + record.valor_total, 0);
    
    // GND 3 = Logística (Classe I + Classe III) + Operacional (0) + Aviação (0)
    const calculatedGND3 = totalClasseI + totalClasseIII;
    
    // GND 4 = Material Permanente (0)
    const calculatedGND4 = 0; 

    setTotalGND3Cost(calculatedGND3);
    setTotalGND4Cost(calculatedGND4);
  };
  
  // Efeito para carregar os totais iniciais e manter a atualização
  useEffect(() => {
    fetchAndSetTotals();
    const interval = setInterval(fetchAndSetTotals, 10000); // Atualiza a cada 10s
    return () => clearInterval(interval);
  }, [ptrabId]);


  const handleItemClick = (itemId: string, type: string) => {
    if (itemId === 'classe-i') {
      navigate(`/ptrab/classe-i?ptrabId=${ptrabId}`);
    } else if (itemId === 'classe-iii') {
      navigate(`/ptrab/classe-iii?ptrabId=${ptrabId}`);
    } else {
      console.log(`Selecionado: ${itemId} do tipo ${type}`);
      // Aqui será implementada a navegação para outros formulários específicos
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
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
    <div className="min-h-screen bg-background py-4 px-4"> {/* Ajustado py-12 para py-4 */}
      <div className="container max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4"> {/* Ajustado mb-6 para mb-4 */}
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
          <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-6 w-6 text-primary" />
                  Dados do P Trab
                </CardTitle>
                <CardDescription>
                  Informações do Plano de Trabalho selecionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Número do PTrab</Label>
                    <p className="text-sm font-medium">{ptrabData?.numero_ptrab}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Nome da Operação</Label>
                    <p className="text-sm font-medium">{ptrabData?.nome_operacao}</p>
                  </div>
                  <div className="space-y-1">
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
                  <div className="space-y-1">
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
            {ptrabId && <PTrabCostSummary ptrabId={ptrabId} />}
            
            {/* Crédito Disponível (NOVO) */}
            <CreditInputCard 
              totalGND3Cost={totalGND3Cost} 
              totalGND4Cost={totalGND4Cost} 
            />
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
    </div>
  );
};

export default PTrabForm;