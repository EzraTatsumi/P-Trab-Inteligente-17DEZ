import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, FileText, Fuel, DollarSign, ClipboardList, Check } from "lucide-react";
import { formatCurrency } from "@/lib/formatUtils";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils"; // Importar a nova função

interface PTrab {
  id: string;
  numero_ptrab: string;
  nome_operacao: string;
  comando_militar_area: string;
  nome_om: string;
  nome_om_extenso?: string;
  codug_om?: string;
  rm_vinculacao?: string;
  codug_rm_vinculacao?: string;
  periodo_inicio: string;
  periodo_fim: string;
  efetivo_empregado: string;
  acoes: string;
  status: string;
  nome_cmt_om?: string;
  local_om?: string;
  totalLogistica?: number;
  totalOperacional?: number;
  updated_at: string;
  comentario?: string;
}

export default function PTrabForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  const [ptrab, setPTrab] = useState<PTrab | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ptrabId) {
      fetchPTrabDetails();
      // Atualiza o status do PTrab para 'em_andamento' se estiver 'aberto'
      updatePTrabStatusIfAberto(ptrabId);
    } else {
      toast.error("ID do PTrab não encontrado.");
      navigate("/ptrab");
    }
  }, [ptrabId, navigate]);

  const fetchPTrabDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("p_trab")
        .select("*")
        .eq("id", ptrabId!)
        .single();

      if (error) throw error;

      if (data) {
        let totalLogisticaCalculado = 0;
        let totalOperacionalCalculado = 0;

        // Fetch Classe I totals
        const { data: classeIData, error: classeIError } = await supabase
          .from('classe_i_registros')
          .select('total_qs, total_qr')
          .eq('p_trab_id', data.id);

        if (classeIError) console.error("Erro ao carregar Classe I para PTrab", data.id, classeIError);
        else {
          totalLogisticaCalculado += (classeIData || []).reduce((sum, record) => sum + record.total_qs + record.total_qr, 0);
        }

        // Fetch Classe III totals
        const { data: classeIIIData, error: classeIIIError } = await supabase
          .from('classe_iii_registros')
          .select('valor_total')
          .eq('p_trab_id', data.id);

        if (classeIIIError) console.error("Erro ao carregar Classe III para PTrab", data.id, classeIIIError);
        else {
          totalLogisticaCalculado += (classeIIIData || []).reduce((sum, record) => sum + record.valor_total, 0);
        }

        setPTrab({
          ...data,
          totalLogistica: totalLogisticaCalculado,
          totalOperacional: totalOperacionalCalculado,
        } as PTrab);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar detalhes do PTrab.");
      console.error(error);
      navigate("/ptrab");
    } finally {
      setLoading(false);
    }
  };

  const calculateDays = (inicio: string, fim: string) => {
    const start = new Date(inicio);
    const end = new Date(fim);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando PTrab...</p>
      </div>
    );
  }

  if (!ptrab) {
    return null; // Ou uma mensagem de erro
  }

  const totalGeral = (ptrab.totalLogistica || 0) + (ptrab.totalOperacional || 0);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={() => navigate("/ptrab")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Gerenciamento de P Trab
          </Button>
          <h1 className="text-3xl font-bold text-center flex-grow">Preencher PTrab</h1>
          <div className="w-fit"></div> {/* Placeholder para alinhar o título */}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              {ptrab.numero_ptrab} - {ptrab.nome_operacao}
            </CardTitle>
            <CardDescription>
              Detalhes do Plano de Trabalho e acesso às abas de preenchimento.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium">Comando Militar de Área:</p>
              <p>{ptrab.comando_militar_area}</p>
            </div>
            <div>
              <p className="font-medium">OM:</p>
              <p>{ptrab.nome_om} ({ptrab.codug_om})</p>
            </div>
            <div>
              <p className="font-medium">Período:</p>
              <p>
                {new Date(ptrab.periodo_inicio).toLocaleDateString('pt-BR')} a{" "}
                {new Date(ptrab.periodo_fim).toLocaleDateString('pt-BR')} (
                {calculateDays(ptrab.periodo_inicio, ptrab.periodo_fim)} dias)
              </p>
            </div>
            <div>
              <p className="font-medium">Efetivo Empregado:</p>
              <p>{ptrab.efetivo_empregado}</p>
            </div>
            <div className="md:col-span-2">
              <p className="font-medium">Ações:</p>
              <p className="whitespace-pre-wrap">{ptrab.acoes || "N/A"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="font-medium">Status:</p>
              <p className="capitalize">{ptrab.status}</p>
            </div>
            <div className="md:col-span-2">
              <p className="font-medium">Última Atualização:</p>
              <p>{new Date(ptrab.updated_at).toLocaleDateString('pt-BR')} {new Date(ptrab.updated_at).toLocaleTimeString('pt-BR')}</p>
            </div>
            <div className="md:col-span-2 border-t pt-4 mt-4">
              <p className="font-medium text-lg">Totais do PTrab:</p>
              <div className="flex flex-col md:flex-row md:justify-between md:items-center mt-2">
                <div className="flex items-center gap-2 text-orange-600">
                  <DollarSign className="h-5 w-5" />
                  <span className="font-semibold">Logístico: {formatCurrency(ptrab.totalLogistica || 0)}</span>
                </div>
                <div className="flex items-center gap-2 text-blue-600 mt-2 md:mt-0">
                  <DollarSign className="h-5 w-5" />
                  <span className="font-semibold">Operacional: {formatCurrency(ptrab.totalOperacional || 0)}</span>
                </div>
                <div className="flex items-center gap-2 text-green-600 font-bold text-xl mt-2 md:mt-0">
                  <Check className="h-6 w-6" />
                  <span>Total Geral: {formatCurrency(totalGeral)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(`/ptrab/classe-i?ptrabId=${ptrabId}`)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold">Classe I - Alimentação</CardTitle>
              <DollarSign className="h-8 w-8 text-green-500" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Gerencie os registros de custeio para alimentação (QS e QR).
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(`/ptrab/classe-iii?ptrabId=${ptrabId}`)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold">Classe III - Combustíveis</CardTitle>
              <Fuel className="h-8 w-8 text-orange-500" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Gerencie os registros de custeio para combustíveis (viaturas, geradores, embarcações).
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="opacity-50 cursor-not-allowed"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold">Classe V - Munição</CardTitle>
              <ClipboardList className="h-8 w-8 text-red-500" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Em breve: Gerencie os registros de custeio para munição.
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="opacity-50 cursor-not-allowed"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold">Classe IX - Material de Saúde</CardTitle>
              <ClipboardList className="h-8 w-8 text-blue-500" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Em breve: Gerencie os registros de custeio para material de saúde.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}