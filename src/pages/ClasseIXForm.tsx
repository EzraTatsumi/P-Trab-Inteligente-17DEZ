import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Package, RefreshCw, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Define types based on Supabase schema
interface PTrab {
  id: string;
  numero_ptrab: string;
  nome_operacao: string;
  status: string;
}

interface ClasseIXRegistro {
  id: string;
  p_trab_id: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  categoria: string;
  valor_total: number;
  itens_motomecanizacao: any[]; // JSONB structure for items
  fase_atividade?: string;
  detalhamento?: string;
  valor_nd_30: number;
  valor_nd_39: number;
}

const fetchPTrabDetails = async (ptrabId: string): Promise<PTrab> => {
  const { data, error } = await supabase
    .from('p_trab')
    .select('id, numero_ptrab, nome_operacao, status')
    .eq('id', ptrabId)
    .single();

  if (error || !data) {
    throw new Error("Não foi possível carregar os detalhes do P Trab.");
  }
  return data;
};

const fetchClasseIXRegistries = async (ptrabId: string): Promise<ClasseIXRegistro[]> => {
  const { data, error } = await supabase
    .from('classe_ix_registros')
    .select('*')
    .eq('p_trab_id', ptrabId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error("Falha ao carregar registros da Classe IX.");
  }
  return data as ClasseIXRegistro[];
};

const ClasseIXForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const queryClient = useQueryClient();
  
  const [selectedTab, setSelectedTab] = useState("registros");

  // Fetch PTrab details
  const { data: ptrab, isLoading: isLoadingPTrab, isError: isErrorPTrab } = useQuery({
    queryKey: ['ptrabDetails', ptrabId],
    queryFn: () => fetchPTrabDetails(ptrabId!),
    enabled: !!ptrabId,
  });

  // Fetch Classe IX Registries
  const { data: registries, isLoading: isLoadingRegistries, refetch: refetchRegistries } = useQuery({
    queryKey: ['classeIXRegistries', ptrabId],
    queryFn: () => fetchClasseIXRegistries(ptrabId!),
    enabled: !!ptrabId,
    initialData: [],
  });

  useEffect(() => {
    if (!ptrabId) {
      toast.error("P Trab não selecionado.");
      navigate('/ptrab');
    }
    if (isErrorPTrab) {
      navigate('/ptrab');
    }
  }, [ptrabId, navigate, isErrorPTrab]);

  if (isLoadingPTrab) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando P Trab...</span>
      </div>
    );
  }
  
  if (!ptrab) return null;

  const isReadOnly = ptrab.status === 'completo' || ptrab.status === 'arquivado';
  
  // Placeholder components for the requested sections
  const SectionDadosOrganizacao = () => (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>1. Dados da Organização</CardTitle>
        <CardDescription>Informações sobre a OM e UG envolvidas na atividade.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Aqui entraria o OmSelector ou campos de UG/Organização */}
        <p className="text-sm text-muted-foreground">Implementação pendente: Seleção de OM/UG.</p>
      </CardContent>
    </Card>
  );

  const SectionConfiguracaoItem = () => (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>2. Configurar Item por Categoria</CardTitle>
        <CardDescription>Definição das diretrizes e valores para Motomecanização.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Aqui entraria a lógica de diretrizes (DiretrizesClasseIX) */}
        <p className="text-sm text-muted-foreground">Implementação pendente: Gerenciamento de Diretrizes da Classe IX.</p>
      </CardContent>
    </Card>
  );
  
  const SectionItensAdicionados = () => (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle>3. Registros de Motomecanização</CardTitle>
          <CardDescription>Itens adicionados ao P Trab e alocação de recursos (ND 30/39).</CardDescription>
        </div>
        {!isReadOnly && (
          <Button size="sm" className="gap-1">
            <PlusCircle className="h-4 w-4" />
            Adicionar Registro
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {registries.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">Nenhum registro de Classe IX adicionado ainda.</p>
        ) : (
          <div className="space-y-2">
            {registries.map((reg) => (
              <div key={reg.id} className="p-3 border rounded-md flex justify-between items-center">
                <span className="font-medium">{reg.categoria} - {reg.organizacao}</span>
                <span className="text-sm font-semibold text-primary">R$ {reg.valor_total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
  
  const SectionOMsCadastradas = () => (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>4. OMs Cadastradas</CardTitle>
        <CardDescription>Visualização das Organizações Militares cadastradas.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Aqui entraria a lista de OMs */}
        <p className="text-sm text-muted-foreground">Implementação pendente: Lista de OMs.</p>
      </CardContent>
    </Card>
  );
  
  const SectionMemoriasCalculo = () => (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>5. Memórias de Cálculos Detalhadas</CardTitle>
        <CardDescription>Visualização dos cálculos que compõem o valor total.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Aqui entraria a tabela de memória de cálculo */}
        <p className="text-sm text-muted-foreground">Implementação pendente: Tabela de Memória de Cálculo.</p>
      </CardContent>
    </Card>
  );


  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="container max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(`/ptrab?ptrabId=${ptrabId}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para o P Trab
          </Button>
          <Button variant="outline" onClick={() => refetchRegistries()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Recarregar Dados
          </Button>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Package className="h-6 w-6 text-primary" />
              Classe IX - Motomecanização
            </CardTitle>
            <CardDescription>
              Preenchimento dos dados logísticos para o P Trab: {ptrab.numero_ptrab} - {ptrab.nome_operacao}
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5 md:grid-cols-5 lg:grid-cols-5">
                <TabsTrigger value="organizacao">1. Dados OM</TabsTrigger>
                <TabsTrigger value="configuracao">2. Configuração</TabsTrigger>
                <TabsTrigger value="registros">3. Registros</TabsTrigger>
                <TabsTrigger value="oms">4. OMs Cadastradas</TabsTrigger>
                <TabsTrigger value="calculos">5. Memória Cálculo</TabsTrigger>
              </TabsList>

              <TabsContent value="organizacao">
                <SectionDadosOrganizacao />
              </TabsContent>
              
              <TabsContent value="configuracao">
                <SectionConfiguracaoItem />
              </TabsContent>
              
              <TabsContent value="registros">
                <SectionItensAdicionados />
              </TabsContent>
              
              <TabsContent value="oms">
                <SectionOMsCadastradas />
              </TabsContent>
              
              <TabsContent value="calculos">
                <SectionMemoriasCalculo />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClasseIXForm;