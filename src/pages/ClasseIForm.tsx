import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2, Pencil, XCircle, Sparkles, Check, ChevronsUpDown } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "@/lib/errorUtils";
import { classeIFormSchema } from "@/lib/validationSchemas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { RmSelector } from "@/components/RmSelector";
import { OMData } from "@/lib/omUtils";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Textarea } from "@/components/ui/textarea"; // Importar Textarea
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";

interface OMRegistro {
  id: string;
  om: string;
  ug: string;
  omQS: string;
  ugQS: string;
  efetivo: number;
  diasOperacao: number;
  nrRefInt: number;
  valorQS: number;
  valorQR: number;
  faseAtividade?: string; // Mantido como string, mas conterá CSV
  memoriaQSCustomizada?: string | null;
  memoriaQRCustomizada?: string | null;
  calculos: {
    nrCiclos: number;
    diasEtapaPaga: number;
    diasEtapaSolicitada: number;
    totalEtapas: number;
    complementoQS: number;
    etapaQS: number;
    totalQS: number;
    complementoQR: number;
    etapaQR: number;
    totalQR: number;
  };
}

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

// Helper function to encapsulate calculation logic
const calculateClasseICalculations = (
  efetivo: number,
  diasOperacao: number,
  nrRefInt: number,
  valorQS: number,
  valorQR: number
) => {
  if (efetivo <= 0 || diasOperacao <= 0) {
    return {
      nrCiclos: 0,
      diasEtapaPaga: 0,
      diasEtapaSolicitada: 0,
      totalEtapas: 0,
      complementoQS: 0,
      etapaQS: 0,
      totalQS: 0,
      complementoQR: 0,
      etapaQR: 0,
      totalQR: 0,
    };
  }

  const B7 = diasOperacao / 30;
  const C7 = Math.floor(B7);
  const D7 = B7 - C7;
  
  const nrCiclos = Math.ceil(diasOperacao / 30);
  const diasEtapaPaga = 22 * nrCiclos;
  
  let diasEtapaSolicitada = 0;
  
  const diasRestantesNoCiclo = diasOperacao % 30;
  const ciclosCompletos = Math.floor(diasOperacao / 30);
  
  if (diasRestantesNoCiclo <= 22 && diasOperacao >= 30) {
    diasEtapaSolicitada = ciclosCompletos * 8;
  } else if (diasRestantesNoCiclo > 22) {
    diasEtapaSolicitada = (diasRestantesNoCiclo - 22) + (ciclosCompletos * 8);
  } else {
    diasEtapaSolicitada = 0; // Se diasOperacao < 30 e <= 22
  }
  
  const totalEtapas = diasEtapaSolicitada + (nrRefInt * diasOperacao);

  const complementoQS = efetivo * Math.min(nrRefInt, 3) * (valorQS / 3) * diasOperacao;
  const etapaQS = efetivo * valorQS * diasEtapaSolicitada;
  const totalQS = complementoQS + etapaQS;

  const complementoQR = efetivo * Math.min(nrRefInt, 3) * (valorQR / 3) * diasOperacao;
  const etapaQR = efetivo * valorQR * diasEtapaSolicitada;
  const totalQR = complementoQR + etapaQR;

  return {
    nrCiclos,
    diasEtapaPaga,
    diasEtapaSolicitada,
    totalEtapas,
    complementoQS,
    etapaQS,
    totalQS,
    complementoQR,
    etapaQR,
    totalQR,
  };
};

// Função para formatar as fases de forma natural no texto
const formatFasesParaTexto = (faseCSV: string | undefined): string => {
  if (!faseCSV) return 'operação';
  
  const fases = faseCSV.split(';').map(f => f.trim()).filter(f => f);
  
  if (fases.length === 0) return 'operação';
  if (fases.length === 1) return fases[0];
  if (fases.length === 2) return `${fases[0]} e ${fases[1]}`;
  
  // 3 ou mais fases: "Fase1, Fase2 e Fase3"
  const ultimaFase = fases[fases.length - 1];
  const demaisFases = fases.slice(0, -1).join(', ');
  return `${demaisFases} e ${ultimaFase}`;
};

// Nova função para gerar a memória de cálculo formatada
const generateClasseIMemoriaCalculo = (registro: OMRegistro): { qs: string, qr: string } => {
  const { om, ug, omQS, ugQS, efetivo, diasOperacao, nrRefInt, valorQS, valorQR, calculos, faseAtividade } = registro;
  
  const diasEtapaSolicitada = calculos.diasEtapaSolicitada;
  const faseFormatada = formatFasesParaTexto(faseAtividade);
  
  // Memória QS (Quantitativo de Subsistência) - Fornecido pela RM (omQS/ugQS)
  const memoriaQS = `33.90.30 - Aquisição de Gêneros Alimentícios (QS) destinados à complementação de alimentação de ${efetivo} militares do ${om}, durante ${diasOperacao} dias de ${faseFormatada}.
OM Fornecedora: ${omQS} (UG: ${ugQS})

Cálculo:
- Valor da Etapa (QS): ${formatCurrency(valorQS)}.
- Nr Refeições Intermediárias: ${nrRefInt}.

Fórmula: [Efetivo empregado x Nr Ref Int (máx 3) x Valor da Etapa/3 x Nr de dias de complemento] + [Efetivo empregado x Valor da etapa x Nr de dias de etapa completa solicitada.]

- [${efetivo} militares do ${om} x ${nrRefInt} Ref Int x (${formatCurrency(valorQS)}/3) x ${diasOperacao} dias de atividade] = ${formatCurrency(calculos.complementoQS)}.
- [${efetivo} militares do ${om} x ${formatCurrency(valorQS)} x ${diasEtapaSolicitada} dias de etapa completa solicitada] = ${formatCurrency(calculos.etapaQS)}.

Total QS: ${formatCurrency(calculos.totalQS)}.`;

  // Memória QR (Quantitativo de Rancho) - Para a OM de Destino (om/ug)
  const memoriaQR = `33.90.30 - Aquisição de Gêneros Alimentícios (QR - Rancho Pronto) destinados à complementação de alimentação de ${efetivo} militares do ${om}, durante ${diasOperacao} dias de ${faseFormatada}.
OM de Destino: ${om} (UG: ${ug})

Cálculo:
- Valor da Etapa (QR): ${formatCurrency(valorQR)}.
- Nr Refeições Intermediárias: ${nrRefInt}.

Fórmula: [Efetivo empregado x Nr Ref Int (máx 3) x Valor da Etapa/3 x Nr de dias de complemento] + [Efetivo empregado x Valor da etapa x Nr de dias de etapa completa solicitada.]

- [${efetivo} militares do ${om} x ${nrRefInt} Ref Int x (${formatCurrency(valorQR)}/3) x ${diasOperacao} dias de atividade] = ${formatCurrency(calculos.complementoQR)}.
- [${efetivo} militares do ${om} x ${formatCurrency(valorQR)} x ${diasEtapaSolicitada} dias de etapa completa solicitada] = ${formatCurrency(calculos.etapaQR)}.

Total QR: ${formatCurrency(calculos.totalQR)}.`;

  return { qs: memoriaQS, qr: memoriaQR };
};


export default function ClasseIForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const [loading, setLoading] = useState(false);
  const [ptrabNome, setPtrabNome] = useState<string>("");
  const [efetivo, setEfetivo] = useState<number>(0);
  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined); // Novo estado para o ID da OM
  const [om, setOm] = useState<string>("");
  const [ug, setUg] = useState<string>("");
  // rmVinculacao não é mais necessário como estado separado, pois omQS/ugQS representam a RM de destino
  const [omQS, setOmQS] = useState<string>("");
  const [ugQS, setUgQS] = useState<string>("");
  const [diasOperacao, setDiasOperacao] = useState<number>(0);
  const [nrRefInt, setNrRefInt] = useState<number>(1);
  const [valorQS, setValorQS] = useState<number>(9.0);
  const [valorQR, setValorQR] = useState<number>(6.0);
  const [registros, setRegistros] = useState<OMRegistro[]>([]);
  const [diretrizAno, setDiretrizAno] = useState<number | null>(null);
  const [editingRegistroId, setEditingRegistroId] = useState<string | null>(null);
  
  // NOVO ESTADO PARA FASE DA ATIVIDADE (Array de strings)
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Estados para controle de edição de memória de cálculo
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaQSEdit, setMemoriaQSEdit] = useState<string>("");
  const [memoriaQREdit, setMemoriaQREdit] = useState<string>("");

  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    checkAuthAndLoadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const checkAuthAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Você precisa estar autenticado");
      navigate("/login");
      return;
    }

    if (!ptrabId) {
      toast.error("Nenhum P Trab selecionado");
      navigate("/ptrab");
      return;
    }

    await loadPTrab(ptrabId);
    await loadDiretrizes();
    await loadRegistros(ptrabId);
  };

  const loadDiretrizes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("diretrizes_custeio")
        .select("*")
        .eq("user_id", user.id)
        .order("ano_referencia", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setValorQS(data.classe_i_valor_qs);
        setValorQR(data.classe_i_valor_qr);
        setDiretrizAno(data.ano_referencia);
      }
    } catch (error: any) {
      console.error("Erro ao carregar diretrizes:", error);
    }
  };

  const loadPTrab = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("p_trab")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPtrabNome(`${data.numero_ptrab} - ${data.nome_operacao}`);
    } catch (error: any) {
      toast.error("Erro ao carregar P Trab");
      navigate("/ptrab");
    }
  };

  const loadRegistros = async (ptrabId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("classe_i_registros")
        .select("*, fase_atividade, memoria_calculo_qs_customizada, memoria_calculo_qr_customizada")
        .eq("p_trab_id", ptrabId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const registrosCarregados: OMRegistro[] = (data || []).map((r) => {
        const derivedCalculations = calculateClasseICalculations(
          r.efetivo,
          r.dias_operacao,
          r.nr_ref_int,
          Number(r.valor_qs),
          Number(r.valor_qr)
        );
        return {
          id: r.id,
          om: r.organizacao,
          ug: r.ug,
          omQS: r.om_qs,
          ugQS: r.ug_qs,
          efetivo: r.efetivo,
          diasOperacao: r.dias_operacao,
          nrRefInt: r.nr_ref_int,
          valorQS: Number(r.valor_qs),
          valorQR: Number(r.valor_qr),
          faseAtividade: r.fase_atividade || 'Execução',
          memoriaQSCustomizada: r.memoria_calculo_qs_customizada,
          memoriaQRCustomizada: r.memoria_calculo_qr_customizada,
          calculos: {
            nrCiclos: derivedCalculations.nrCiclos,
            diasEtapaPaga: derivedCalculations.diasEtapaPaga,
            diasEtapaSolicitada: derivedCalculations.diasEtapaSolicitada,
            totalEtapas: derivedCalculations.totalEtapas,
            complementoQS: Number(r.complemento_qs),
            etapaQS: Number(r.etapa_qs),
            totalQS: Number(r.total_qs),
            complementoQR: Number(r.complemento_qr),
            etapaQR: Number(r.etapa_qr),
            totalQR: Number(r.total_qr),
          },
        };
      });

      setRegistros(registrosCarregados);
    } catch (error: any) {
      toast.error("Erro ao carregar registros");
    } finally {
      setLoading(false);
    }
  };

  const calculos = useMemo(() => {
    return calculateClasseICalculations(efetivo, diasOperacao, nrRefInt, valorQS, valorQR);
  }, [efetivo, diasOperacao, nrRefInt, valorQS, valorQR]);

  const resetFormFields = () => {
    setSelectedOmId(undefined);
    setOm("");
    setUg("");
    setOmQS("");
    setUgQS("");
    setEfetivo(0);
    setDiasOperacao(0);
    setNrRefInt(1);
    setEditingRegistroId(null);
    setFasesAtividade(["Execução"]);
    setCustomFaseAtividade("");
  };

  const handleOMChange = async (omData: OMData | undefined) => {
    if (omData) {
      setSelectedOmId(omData.id);
      setOm(omData.nome_om);
      setUg(omData.codug_om);
      // Define a RM de vinculação da OM como padrão para a RM que receberá o QS
      setOmQS(omData.rm_vinculacao);
      setUgQS(omData.codug_rm_vinculacao);
    } else {
      setSelectedOmId(undefined);
      setOm("");
      setUg("");
      setOmQS("");
      setUgQS("");
    }
  };

  const handleRMQSChange = (rmName: string, rmCodug: string) => {
    setOmQS(rmName);
    setUgQS(rmCodug);
  };

  const handleFaseChange = (fase: string, isChecked: boolean) => {
    if (isChecked) {
      setFasesAtividade(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividade(prev => prev.filter(f => f !== fase));
    }
  };

  const handleCadastrar = async () => {
    if (!ptrabId) {
      toast.error("P Trab não selecionado");
      return;
    }

    const validationResult = classeIFormSchema.safeParse({
      organizacao: om,
      ug: ug,
      om_qs: omQS,
      ug_qs: ugQS,
      efetivo: efetivo,
      dias_operacao: diasOperacao,
      nr_ref_int: nrRefInt,
      valor_qs: valorQS,
      valor_qr: valorQR,
    });

    if (!validationResult.success) {
      toast.error(validationResult.error.errors[0].message);
      return;
    }
    
    // Constrói a string final da fase de atividade
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) {
      fasesFinais = [...fasesFinais, customFaseAtividade.trim()];
    }
    
    const faseFinalString = fasesFinais.filter(f => f && FASES_PADRAO.includes(f) || f === customFaseAtividade.trim()).join('; ');

    if (!faseFinalString) {
      toast.error("Selecione ou digite pelo menos uma Fase da Atividade.");
      return;
    }

    try {
      setLoading(true);

      const registroData = {
        p_trab_id: ptrabId,
        organizacao: om,
        ug: ug,
        om_qs: omQS,
        ug_qs: ugQS,
        efetivo: efetivo,
        dias_operacao: diasOperacao,
        nr_ref_int: nrRefInt,
        valor_qs: valorQS,
        valor_qr: valorQR,
        complemento_qs: calculos.complementoQS,
        etapa_qs: calculos.etapaQS,
        total_qs: calculos.totalQS,
        complemento_qr: calculos.complementoQR,
        etapa_qr: calculos.etapaQR,
        total_qr: calculos.totalQR,
        total_geral: calculos.totalQS + calculos.totalQR,
        fase_atividade: faseFinalString, // Salvar a string CSV
      };

      if (editingRegistroId) {
        const { error } = await supabase
          .from("classe_i_registros")
          .update(registroData)
          .eq("id", editingRegistroId);

        if (error) throw error;
        toast.success("OM atualizada com sucesso!");
      } else {
        const { data, error } = await supabase
          .from("classe_i_registros")
          .insert([registroData])
          .select()
          .single();

        if (error) throw error;
        toast.success("OM cadastrada com sucesso!");
      }
      
      // Atualiza o status do PTrab para 'em_andamento' se estiver 'aberto'
      await updatePTrabStatusIfAberto(ptrabId);

      resetFormFields();
      loadRegistros(ptrabId);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este registro?")) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("classe_i_registros")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setRegistros(registros.filter((r) => r.id !== id));
      toast.success("OM removida com sucesso!");
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEditRegistro = async (registro: OMRegistro) => {
    setEditingRegistroId(registro.id);
    setOm(registro.om);
    setUg(registro.ug);
    setOmQS(registro.omQS);
    setUgQS(registro.ugQS);
    setEfetivo(registro.efetivo);
    setDiasOperacao(registro.diasOperacao);
    setNrRefInt(registro.nrRefInt);
    setValorQS(registro.valorQS);
    setValorQR(registro.valorQR);
    
    // Preencher fasesAtividade
    const fasesSalvas = (registro.faseAtividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    
    const fasesPadraoSelecionadas = fasesSalvas.filter(f => FASES_PADRAO.includes(f));
    const faseCustomizada = fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "";
    
    setFasesAtividade(fasesPadraoSelecionadas);
    setCustomFaseAtividade(faseCustomizada);

    // Buscar o ID da OM para preencher o OmSelector
    try {
      const { data: omData, error: omError } = await supabase
        .from('organizacoes_militares')
        .select('id')
        .eq('nome_om', registro.om)
        .eq('codug_om', registro.ug)
        .single();
      if (omData && !omError) {
        setSelectedOmId(omData.id);
      }
    } catch (error) {
      console.error("Erro ao buscar ID da OM para edição:", error);
      setSelectedOmId(undefined);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleIniciarEdicaoMemoria = (registro: OMRegistro) => {
    const { qs, qr } = generateClasseIMemoriaCalculo(registro);
    
    setEditingMemoriaId(registro.id);
    setMemoriaQSEdit(registro.memoriaQSCustomizada || qs);
    setMemoriaQREdit(registro.memoriaQRCustomizada || qr);
  };

  const handleCancelarEdicaoMemoria = () => {
    setEditingMemoriaId(null);
    setMemoriaQSEdit("");
    setMemoriaQREdit("");
  };

  const handleSalvarMemoriaCustomizada = async (registroId: string) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from("classe_i_registros")
        .update({
          memoria_calculo_qs_customizada: memoriaQSEdit,
          memoria_calculo_qr_customizada: memoriaQREdit,
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo atualizada com sucesso!");
      handleCancelarEdicaoMemoria();
      await loadRegistros(ptrabId!);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
    if (!confirm("Deseja restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
      return;
    }
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from("classe_i_registros")
        .update({
          memoria_calculo_qs_customizada: null,
          memoria_calculo_qr_customizada: null,
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo restaurada!");
      await loadRegistros(ptrabId!);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const totalGeralQS = registros.reduce((sum, r) => sum + r.calculos.totalQS, 0);
  const totalGeralQR = registros.reduce((sum, r) => sum + r.calculos.totalQR, 0);
  const totalGeral = totalGeralQS + totalGeralQR;

  const displayFases = [...fasesAtividade, customFaseAtividade.trim()].filter(f => f).join(', ');

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-2">
        <Button
          variant="ghost"
          onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card className="p-6 backdrop-blur-sm bg-card/95 border-primary/10">
          <div className="mb-4">
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Classe I - Subsistência
            </h1>
            <p className="text-muted-foreground">
              Configure a sua necessidade de alimentação (QS e QR) por OM.
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleCadastrar(); }} className="space-y-4">
            {/* Dados Básicos */}
            <div className="grid md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="om">OM de Destino (QR)</Label>
                <OmSelector
                  selectedOmId={selectedOmId}
                  onChange={handleOMChange}
                  placeholder="Selecione uma OM de Destino..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ug">CODUG de Destino (QR)</Label>
                <Input
                  id="ug"
                  value={ug}
                  readOnly
                  disabled={true}
                  className="disabled:opacity-60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="omQS">RM que receberá o QS</Label>
                <RmSelector
                  value={omQS}
                  onChange={handleRMQSChange}
                  placeholder="Selecione a RM de destino do QS..."
                  disabled={!om}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ugQS">CODUG da RM do QS</Label>
                <Input
                  id="ugQS"
                  value={ugQS}
                  readOnly
                  disabled={true}
                  className="disabled:opacity-60"
                />
              </div>
            </div>

            {/* Efetivo e Dias */}
            <div className="grid md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="efetivo">Efetivo de Militares</Label>
                <Input
                  id="efetivo"
                  type="number"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={efetivo === 0 ? "" : efetivo.toString()}
                  onChange={(e) => setEfetivo(Number(e.target.value))}
                  placeholder="Ex: 246"
                  onKeyDown={handleEnterToNextField}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="diasOperacao">Dias de atividade</Label>
                <Input
                  id="diasOperacao"
                  type="number"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={diasOperacao === 0 ? "" : diasOperacao.toString()}
                  onChange={(e) => setDiasOperacao(Number(e.target.value))}
                  placeholder="Ex: 30"
                  onKeyDown={handleEnterToNextField}
                />
              </div>
            </div>

            {/* Configuração de Valores e Fase da Atividade */}
            <div className="grid md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="nrRefInt">
                  Nº Refeições Intermediárias
                </Label>
                <Select
                  value={nrRefInt.toString()}
                  onValueChange={(value) => setNrRefInt(Number(value))}
                >
                  <SelectTrigger id="nrRefInt">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="1">1 refeição</SelectItem>
                    <SelectItem value="2">2 refeições</SelectItem>
                    <SelectItem value="3">3 refeições</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="faseAtividade">Fase da Atividade</Label>
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      type="button"
                      className="w-full justify-between"
                    >
                      <span className="truncate">
                        {displayFases || "Selecione a(s) fase(s)..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandGroup>
                        {FASES_PADRAO.map((fase) => (
                          <CommandItem
                            key={fase}
                            value={fase}
                            onSelect={() => handleFaseChange(fase, !fasesAtividade.includes(fase))}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={fasesAtividade.includes(fase)}
                                onCheckedChange={(checked) => handleFaseChange(fase, !!checked)}
                              />
                              <Label>{fase}</Label>
                            </div>
                            {fasesAtividade.includes(fase) && <Check className="ml-auto h-4 w-4" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <div className="p-2 border-t">
                        <Label className="text-xs text-muted-foreground mb-1 block">Outra Atividade (Opcional)</Label>
                        <Input
                          value={customFaseAtividade}
                          onChange={(e) => setCustomFaseAtividade(e.target.value)}
                          placeholder="Ex: Patrulhamento"
                          onKeyDown={handleEnterToNextField}
                        />
                      </div>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Botão Cadastrar/Atualizar e Cancelar */}
            <div className="flex justify-end gap-2">
              {editingRegistroId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetFormFields}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar Edição
                </Button>
              )}
              <Button
                type="submit"
                className="gap-2"
                disabled={loading || !om || !ug || !omQS || !ugQS || efetivo <= 0 || diasOperacao <= 0 || (!displayFases)}
              >
                <Plus className="h-4 w-4" />
                {loading ? "Aguarde..." : (editingRegistroId ? "Atualizar OM" : "Cadastrar OM")}
              </Button>
            </div>
          </form>

            {/* Preview dos Cálculos */}
            {efetivo > 0 && diasOperacao > 0 && (
              <div className="space-y-6 mt-6">
                {/* Informações de Ciclo */}
                <div className="p-6 bg-primary/5 rounded-lg border border-primary/10">
                  <h3 className="font-semibold text-lg mb-4">Ciclo de Operação</h3>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Nº Ciclos (30 dias)</p>
                      <p className="text-2xl font-bold">{calculos.nrCiclos}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Dias Etapa Paga</p>
                      <p className="text-2xl font-bold">{calculos.diasEtapaPaga}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Dias Etapa Solicitada</p>
                      <p className="text-2xl font-bold">{calculos.diasEtapaSolicitada}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Dias de Complemento</p>
                      <p className="text-2xl font-bold">{diasOperacao}</p>
                    </div>
                  </div>
                </div>

                {/* Cálculos QS */}
                <div className="p-6 bg-blue-500/5 rounded-lg border border-blue-500/10">
                  <h3 className="font-semibold text-lg mb-4">Quantitativo de Subsistência (QS)</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Valor Etapa QS (R$ {valorQS.toFixed(2)} x {calculos.diasEtapaSolicitada} dias)</span>
                      <span className="font-semibold">{formatCurrency(calculos.etapaQS)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        Valor Complemento QS ({efetivo} militares x {Math.min(nrRefInt, 3)} Ref Int x R$ {(valorQS / 3).toFixed(2)}/Ref Int x {diasOperacao} dias)
                      </span>
                      <span className="font-semibold">{formatCurrency(calculos.complementoQS)}</span>
                    </div>
                    <div className="h-px bg-border my-2" />
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-bold">Total QS</span>
                      <span className="font-bold text-blue-600">{formatCurrency(calculos.totalQS)}</span>
                    </div>
                  </div>
                </div>

                {/* Cálculos QR */}
                <div className="p-6 bg-green-500/5 rounded-lg border border-green-500/10">
                  <h3 className="font-semibold text-lg mb-4">Quantitativo de Rancho (QR)</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Valor Etapa QR (R$ {valorQR.toFixed(2)} x {calculos.diasEtapaSolicitada} dias)</span>
                      <span className="font-semibold">{formatCurrency(calculos.etapaQR)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        Valor Complemento QR ({efetivo} militares x {Math.min(nrRefInt, 3)} Ref Int x R$ {(valorQR / 3).toFixed(2)}/Ref Int x {diasOperacao} dias)
                      </span>
                      <span className="font-semibold">{formatCurrency(calculos.complementoQR)}</span>
                    </div>
                    <div className="h-px bg-border my-2" />
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-bold">Total QR</span>
                      <span className="font-bold text-green-600">{formatCurrency(calculos.totalQR)}</span>
                    </div>
                  </div>
                </div>

                {/* Total Geral */}
                <div className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border-2 border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold">Valor Total a Solicitar</span>
                    <span className="text-3xl font-bold text-primary">
                      {formatCurrency(calculos.totalQS + calculos.totalQR)}
                    </span>
                  </div>
                </div>

                {/* Memória de Cálculo */}
                <div className="p-6 bg-muted/50 rounded-lg">
                  <h3 className="font-semibold text-lg mb-4">Memória de Cálculo</h3>
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="font-semibold mb-2">QS - Quantitativo de Subsistência:</p>
                      <p className="text-muted-foreground">
                        • Complemento: [{efetivo} militares x {nrRefInt} Ref Int x (R$ {valorQS.toFixed(2)}/3) x {diasOperacao} dias] = {formatCurrency(calculos.complementoQS)}
                      </p>
                      <p className="text-muted-foreground">
                        • Etapa: [{efetivo} militares x R$ {valorQS.toFixed(2)} x {calculos.diasEtapaSolicitada} dias] = {formatCurrency(calculos.etapaQS)}
                      </p>
                      <p className="font-semibold mt-2">Total QS: {formatCurrency(calculos.totalQS)}</p>
                    </div>
                    
                    <div className="h-px bg-border" />
                    
                    <div>
                      <p className="font-semibold mb-2">QR - Quantitativo de Rancho:</p>
                      <p className="text-muted-foreground">
                        • Complemento: [{efetivo} militares x {nrRefInt} Ref Int x (R$ {valorQR.toFixed(2)}/3) x {diasOperacao} dias] = {formatCurrency(calculos.complementoQR)}
                      </p>
                      <p className="text-muted-foreground">
                        • Etapa: [{efetivo} militares x R$ {valorQR.toFixed(2)} x {calculos.diasEtapaSolicitada} dias] = {formatCurrency(calculos.etapaQR)}
                      </p>
                      <p className="font-semibold mt-2">Total QR: {formatCurrency(calculos.totalQR)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tabela de Registros */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-accent" />
                    OMs Cadastradas
                  </h2>
                  <Badge variant="secondary" className="text-sm">
                    {registros.length} {registros.length === 1 ? 'registro' : 'registros'}
                  </Badge>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3 font-semibold text-sm w-[12%]">OM Destino (QR)</th>
                          <th className="text-center p-3 font-semibold text-sm w-[9%]">UG (QR)</th>
                          <th className="text-left p-3 font-semibold text-sm w-[12%]">RM QS</th>
                          <th className="text-center p-3 font-semibold text-sm w-[10%]">CODUG RM QS</th>
                          <th className="text-center p-3 font-semibold text-sm w-[8%]">Efetivo</th>
                          <th className="text-center p-3 font-semibold text-sm w-[8%]">Dias</th>
                          <th className="text-right p-3 font-semibold text-sm w-[11%]">Total QS</th>
                          <th className="text-right p-3 font-semibold text-sm w-[11%]">Total QR</th>
                          <th className="text-right p-3 font-semibold text-sm w-[11%]">Total</th>
                          <th className="text-center p-3 font-semibold text-sm w-[8%]">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registros.map((registro) => (
                          <tr key={registro.id} className="border-t hover:bg-muted/50">
                            <td className="p-3 text-sm">{registro.om}</td>
                            <td className="p-3 text-sm text-center">{registro.ug}</td>
                            <td className="p-3 text-sm">{registro.omQS}</td>
                            <td className="p-3 text-sm text-center">{registro.ugQS}</td>
                            <td className="p-3 text-sm text-center">{registro.efetivo}</td>
                            <td className="p-3 text-sm text-center">{registro.diasOperacao}</td>
                            <td className="p-3 px-4 text-sm text-right font-medium text-blue-600 whitespace-nowrap">
                              {formatCurrency(registro.calculos.totalQS)}
                            </td>
                            <td className="p-3 px-4 text-sm text-right font-medium text-green-600 whitespace-nowrap">
                              {formatCurrency(registro.calculos.totalQR)}
                            </td>
                            <td className="p-3 px-4 text-sm text-right font-bold whitespace-nowrap">
                              {formatCurrency(registro.calculos.totalQS + registro.calculos.totalQR)}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex gap-1 justify-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditRegistro(registro)}
                                  disabled={loading}
                                  className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemover(registro.id)}
                                  disabled={loading}
                                  className="h-8 w-8 text-destructive hover:text-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/50 border-t-2">
                        <tr>
                          <td colSpan={6} className="p-3 text-right text-sm font-semibold">
                            TOTAL GERAL:
                          </td>
                          <td className="p-3 px-4 text-sm text-right font-bold text-blue-600 whitespace-nowrap">
                            {formatCurrency(totalGeralQS)}
                          </td>
                          <td className="p-3 px-4 text-sm text-right font-bold text-green-600 whitespace-nowrap">
                            {formatCurrency(totalGeralQR)}
                          </td>
                          <td className="p-3 px-4 text-sm text-right font-extrabold text-primary text-base whitespace-nowrap">
                            {formatCurrency(totalGeral)}
                          </td>
                          <td className="p-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Detalhamento das Memórias de Cálculo - NOVO FORMATO */}
                <div className="space-y-4 mt-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    📋 Memórias de Cálculo Detalhadas
                  </h3>
                  
                  {registros.map((registro) => {
                    const { qs, qr } = generateClasseIMemoriaCalculo(registro);
                    const isEditing = editingMemoriaId === registro.id;
                    const hasCustomMemoria = !!(registro.memoriaQSCustomizada || registro.memoriaQRCustomizada);
                    
                    const memoriaQSFinal = isEditing ? memoriaQSEdit : (registro.memoriaQSCustomizada || qs);
                    const memoriaQRFinal = isEditing ? memoriaQREdit : (registro.memoriaQRCustomizada || qr);
                    
                    return (
                      <Card key={registro.id} className="p-6 bg-muted/30">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-semibold text-foreground">
                              {registro.om} (UG: {registro.ug})
                            </h4>
                            {hasCustomMemoria && !isEditing && (
                              <Badge variant="outline" className="text-xs">
                                Editada manualmente
                              </Badge>
                            )}
                          </div>
                          <Badge 
                            variant="default" 
                            className="bg-primary text-primary-foreground"
                          >
                            Classe I
                          </Badge>
                        </div>
                        <div className="h-px bg-border my-4" /> 
                        
                        {/* Bloco QS */}
                        <div className="space-y-2 mb-6">
                          <div className="flex items-center justify-between">
                            <h5 className="font-bold text-sm text-blue-600">QS - Quantitativo de Subsistência (RM: {registro.omQS})</h5>
                            
                            <div className="flex items-center gap-2">
                              {!isEditing ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleIniciarEdicaoMemoria(registro)}
                                    disabled={loading}
                                    className="gap-2"
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Editar Memória
                                  </Button>
                                  
                                  {hasCustomMemoria && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleRestaurarMemoriaAutomatica(registro.id)}
                                      disabled={loading}
                                      className="gap-2 text-muted-foreground"
                                    >
                                      <XCircle className="h-4 w-4" />
                                      Restaurar Automática
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleSalvarMemoriaCustomizada(registro.id)}
                                    disabled={loading}
                                    className="gap-2"
                                  >
                                    <Check className="h-4 w-4" />
                                    Salvar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelarEdicaoMemoria}
                                    disabled={loading}
                                    className="gap-2"
                                  >
                                    <XCircle className="h-4 w-4" />
                                    Cancelar
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <Card className="p-4 bg-background rounded-lg border">
                            <Textarea
                              value={memoriaQSFinal}
                              onChange={(e) => isEditing && setMemoriaQSEdit(e.target.value)}
                              readOnly={!isEditing}
                              rows={10}
                              className={cn(
                                "font-mono text-xs whitespace-pre-wrap text-foreground",
                                isEditing && "border-blue-500 focus:ring-2 focus:ring-blue-500"
                              )}
                            />
                          </Card>
                        </div>

                        {/* Bloco QR */}
                        <div className="space-y-2">
                          <h5 className="font-bold text-sm text-green-600">QR - Quantitativo de Rancho (OM: {registro.om})</h5>
                          <Card className="p-4 bg-background rounded-lg border">
                            <Textarea
                              value={memoriaQRFinal}
                              onChange={(e) => isEditing && setMemoriaQREdit(e.target.value)}
                              readOnly={!isEditing}
                              rows={10}
                              className={cn(
                                "font-mono text-xs whitespace-pre-wrap text-foreground",
                                isEditing && "border-green-500 focus:ring-2 focus:ring-green-500"
                              )}
                            />
                          </Card>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          
        </Card>
      </div>
    </div>
  );
}