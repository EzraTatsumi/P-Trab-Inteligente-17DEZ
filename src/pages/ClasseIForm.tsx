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
import { 
  formatCurrency, 
  formatNumber, 
  formatNumberForInput, 
  parseInputToNumber, 
  numberToRawDigits,
  formatCurrencyInput
} from "@/lib/formatUtils";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// New types for Classe I categories
type CategoriaClasseI = 'RACAO_QUENTE' | 'RACAO_OPERACIONAL';
const CATEGORIAS_CLASSE_I: CategoriaClasseI[] = ['RACAO_QUENTE', 'RACAO_OPERACIONAL'];

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

// Helper function to encapsulate calculation logic
const calculateClasseICalculations = (
  efetivo: number | null,
  diasOperacao: number,
  nrRefInt: number,
  valorQS: number,
  valorQR: number
) => {
  const E = efetivo || 0;
  const D = diasOperacao || 0;
  const R = nrRefInt || 0;
  const VQS = valorQS || 0;
  const VQR = valorQR || 0;

  if (E <= 0 || D <= 0) {
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

  const nrCiclos = Math.ceil(D / 30);
  const diasEtapaPaga = 22 * nrCiclos;
  
  let diasEtapaSolicitada = 0;
  
  const diasRestantesNoCiclo = D % 30;
  const ciclosCompletos = Math.floor(D / 30);
  
  if (diasRestantesNoCiclo <= 22 && D >= 30) {
    diasEtapaSolicitada = ciclosCompletos * 8;
  } else if (diasRestantesNoCiclo > 22) {
    diasEtapaSolicitada = (diasRestantesNoCiclo - 22) + (ciclosCompletos * 8);
  } else {
    diasEtapaSolicitada = 0;
  }
  
  const totalEtapas = diasEtapaSolicitada + (R * D);

  const complementoQS = E * Math.min(R, 3) * (VQS / 3) * D;
  const etapaQS = E * VQS * diasEtapaSolicitada;
  const totalQS = complementoQS + etapaQS;

  const complementoQR = E * Math.min(R, 3) * (VQR / 3) * D;
  const etapaQR = E * VQR * diasEtapaSolicitada;
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

// Updated interface for records loaded from DB
interface ClasseIRegistro {
  id: string;
  categoria: CategoriaClasseI;
  organizacao: string;
  ug: string;
  diasOperacao: number;
  faseAtividade?: string | null;
  
  // RACAO_QUENTE specific fields
  omQS: string | null;
  ugQS: string | null;
  efetivo: number | null;
  nrRefInt: number | null;
  valorQS: number | null;
  valorQR: number | null;
  memoriaQSCustomizada?: string | null;
  memoriaQRCustomizada?: string | null;
  
  // Calculated fields (only for RACAO_QUENTE)
  calculos: {
    totalQS: number;
    totalQR: number;
    nrCiclos: number;
    diasEtapaPaga: number;
    diasEtapaSolicitada: number;
    totalEtapas: number;
    complementoQS: number;
    etapaQS: number;
    complementoQR: number;
    etapaQR: number;
  };
  
  // RACAO_OPERACIONAL specific fields
  quantidadeR2: number | null;
  quantidadeR3: number | null;
}

// Função para formatar as fases de forma natural no texto
const formatFasesParaTexto = (faseCSV: string | undefined | null): string => {
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

// Nova função para gerar a memória de cálculo formatada para Ração Quente
const generateRacaoQuenteMemoriaCalculo = (registro: ClasseIRegistro): { qs: string, qr: string } => {
  const { organizacao, ug, omQS, ugQS, efetivo, diasOperacao, nrRefInt, valorQS, valorQR, calculos, faseAtividade } = registro;
  
  if (registro.categoria !== 'RACAO_QUENTE' || efetivo === null || valorQS === null || valorQR === null || nrRefInt === null || omQS === null || ugQS === null) {
      return { qs: "Memória não aplicável para Ração Operacional.", qr: "" };
  }
  
  const E = efetivo;
  const D = diasOperacao;
  const R = nrRefInt;
  const VQS = valorQS;
  const VQR = valorQR;
  
  const diasEtapaSolicitada = calculos.diasEtapaSolicitada;
  const faseFormatada = formatFasesParaTexto(faseAtividade);
  
  // Memória QS (Quantitativo de Subsistência) - Fornecido pela RM (omQS/ugQS)
  const memoriaQS = `33.90.30 - Aquisição de Gêneros Alimentícios (QS) destinados à complementação de alimentação de ${E} militares do ${organizacao}, durante ${D} dias de ${faseFormatada}.
OM Fornecedora: ${omQS} (UG: ${ugQS})

Cálculo:
- Valor da Etapa (QS): ${formatCurrency(VQS)}.
- Nr Refeições Intermediárias: ${R}.

Fórmula: [Efetivo empregado x Nr Ref Int (máx 3) x Valor da Etapa/3 x Nr de dias de complemento] + [Efetivo empregado x Valor da etapa x Nr de dias de etapa completa solicitada.]

- [${E} militares do ${organizacao} x ${R} Ref Int x (${formatCurrency(VQS)}/3) x ${D} dias de atividade] = ${formatCurrency(calculos.complementoQS)}.
- [${E} militares do ${organizacao} x ${formatCurrency(VQS)} x ${diasEtapaSolicitada} dias de etapa completa solicitada] = ${formatCurrency(calculos.etapaQS)}.

Total QS: ${formatCurrency(calculos.totalQS)}.`;

  // Memória QR (Quantitativo de Rancho) - Para a OM de Destino (organizacao/ug)
  const memoriaQR = `33.90.30 - Aquisição de Gêneros Alimentícios (QR - Rancho Pronto) destinados à complementação de alimentação de ${E} militares do ${organizacao}, durante ${D} dias de ${faseFormatada}.
OM de Destino: ${organizacao} (UG: ${ug})

Cálculo:
- Valor da Etapa (QR): ${formatCurrency(VQR)}.
- Nr Refeições Intermediárias: ${R}.

Fórmula: [Efetivo empregado x Nr Ref Int (máx 3) x Valor da Etapa/3 x Nr de dias de complemento] + [Efetivo empregado x Valor da etapa x Nr de dias de etapa completa solicitada.]

- [${E} militares do ${organizacao} x ${R} Ref Int x (${formatCurrency(VQR)}/3) x ${D} dias de atividade] = ${formatCurrency(calculos.complementoQR)}.
- [${E} militares do ${organizacao} x ${formatCurrency(VQR)} x ${diasEtapaSolicitada} dias de etapa completa solicitada] = ${formatCurrency(calculos.etapaQR)}.

Total QR: ${formatCurrency(calculos.totalQR)}.`;

  return { qs: memoriaQS, qr: memoriaQR };
};

// Nova função para gerar a memória de cálculo formatada para Ração Operacional
const generateRacaoOperacionalMemoriaCalculo = (registro: ClasseIRegistro): string => {
    if (registro.categoria !== 'RACAO_OPERACIONAL') {
        return "Memória não aplicável para Ração Quente.";
    }
    
    const { organizacao, ug, efetivo, diasOperacao, quantidadeR2, quantidadeR3, faseAtividade } = registro;
    
    const E = efetivo || 0;
    const D = diasOperacao || 0;
    const R2 = quantidadeR2 || 0;
    const R3 = quantidadeR3 || 0;
    const totalRacoes = R2 + R3;
    const faseFormatada = formatFasesParaTexto(faseAtividade);

    return `33.90.30 - Aquisição de Ração Operacional (R2/R3) para ${E} militares do ${organizacao}, durante ${D} dias de ${faseFormatada}.
OM de Destino: ${organizacao} (UG: ${ug})

Cálculo:
- Ração Operacional R2 (24h): ${R2} unidades.
- Ração Operacional R3 (12h): ${R3} unidades.

Total de Rções Operacionais: ${totalRacoes} unidades.
(Nota: O valor monetário desta solicitação é considerado R$ 0,00 para fins de cálculo logístico interno, conforme diretriz atual, mas o quantitativo é registrado.)`;
};


export default function ClasseIForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const [loading, setLoading] = useState(false);
  const [ptrabNome, setPtrabNome] = useState<string>("");
  
  // --- Global OM/Activity State ---
  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);
  const [organizacao, setOrganizacao] = useState<string>("");
  const [ug, setUg] = useState<string>("");
  const [diasOperacao, setDiasOperacao] = useState<number>(0);
  const [efetivo, setEfetivo] = useState<number>(0);
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  // --- RACAO_QUENTE State ---
  const [omQS, setOmQS] = useState<string>("");
  const [ugQS, setUgQS] = useState<string>("");
  const [nrRefInt, setNrRefInt] = useState<number>(1);
  const [valorQS, setValorQS] = useState<number>(9.0);
  const [valorQR, setValorQR] = useState<number>(6.0);
  const [rawQSInput, setRawQSInput] = useState<string>(numberToRawDigits(9.0));
  const [rawQRInput, setRawQRInput] = useState<string>(numberToRawDigits(6.0));
  
  // --- RACAO_OPERACIONAL State ---
  const [quantidadeR2, setQuantidadeR2] = useState<number>(0);
  const [quantidadeR3, setQuantidadeR3] = useState<number>(0);
  
  // --- General Control State ---
  const [registros, setRegistros] = useState<ClasseIRegistro[]>([]);
  const [diretrizAno, setDiretrizAno] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<CategoriaClasseI>('RACAO_QUENTE');
  const [editingRegistroId, setEditingRegistroId] = useState<string | null>(null);
  
  // Estados para controle de edição de memória de cálculo
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaQSEdit, setMemoriaQSEdit] = useState<string>("");
  const [memoriaQREdit, setMemoriaQREdit] = useState<string>("");

  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    checkAuthAndLoadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const loadDiretrizes = async (userId: string) => {
    try {
      let anoReferencia: number | null = null;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("default_diretriz_year")
        .eq("id", userId)
        .maybeSingle();
        
      if (profileData?.default_diretriz_year) {
          anoReferencia = profileData.default_diretriz_year;
      }

      if (!anoReferencia) {
          const { data: diretrizCusteio } = await supabase
            .from("diretrizes_custeio")
            .select("ano_referencia")
            .eq("user_id", userId)
            .order("ano_referencia", { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (diretrizCusteio) {
            anoReferencia = diretrizCusteio.ano_referencia;
          }
      }
      
      if (!anoReferencia) {
        setValorQS(9.0);
        setValorQR(6.0);
        setRawQSInput(numberToRawDigits(9.0));
        setRawQRInput(numberToRawDigits(6.0));
        setDiretrizAno(null);
        return;
      }

      const { data, error } = await supabase
        .from("diretrizes_custeio")
        .select("*")
        .eq("user_id", userId)
        .eq("ano_referencia", anoReferencia)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const qs = Number(data.classe_i_valor_qs);
        const qr = Number(data.classe_i_valor_qr);
        setValorQS(qs);
        setValorQR(qr);
        setRawQSInput(numberToRawDigits(qs));
        setRawQRInput(numberToRawDigits(qr));
        setDiretrizAno(data.ano_referencia);
      }
    } catch (error: any) {
      console.error("Erro ao carregar diretrizes:", error);
    }
  };

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
    await loadDiretrizes(session.user.id);
    await loadRegistros(ptrabId);
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
        .select("*, fase_atividade, memoria_calculo_qs_customizada, memoria_calculo_qr_customizada, categoria, quantidade_r2, quantidade_r3")
        .eq("p_trab_id", ptrabId)
        .order("organizacao", { ascending: true })
        .order("categoria", { ascending: true });

      if (error) throw error;

      const registrosCarregados: ClasseIRegistro[] = (data || []).map((r) => {
        const categoria = (r.categoria || 'RACAO_QUENTE') as CategoriaClasseI;
        
        // Only calculate if RACAO_QUENTE and necessary fields are present
        const isRacaoQuenteValid = categoria === 'RACAO_QUENTE' && r.efetivo && r.valor_qs && r.valor_qr && r.nr_ref_int;
        
        const derivedCalculations = isRacaoQuenteValid
          ? calculateClasseICalculations(
              r.efetivo,
              r.dias_operacao,
              r.nr_ref_int!,
              Number(r.valor_qs!),
              Number(r.valor_qr!)
            )
          : {
              nrCiclos: 0, diasEtapaPaga: 0, diasEtapaSolicitada: 0, totalEtapas: 0,
              complementoQS: 0, etapaQS: 0, totalQS: 0, complementoQR: 0, etapaQR: 0, totalQR: 0,
            };

        return {
          id: r.id,
          categoria: categoria,
          organizacao: r.organizacao,
          ug: r.ug,
          diasOperacao: r.dias_operacao,
          faseAtividade: r.fase_atividade,
          
          // RACAO_QUENTE fields
          omQS: r.om_qs,
          ugQS: r.ug_qs,
          efetivo: r.efetivo,
          nrRefInt: r.nr_ref_int,
          valorQS: r.valor_qs ? Number(r.valor_qs) : null,
          valorQR: r.valor_qr ? Number(r.valor_qr) : null,
          memoriaQSCustomizada: r.memoria_calculo_qs_customizada,
          memoriaQRCustomizada: r.memoria_calculo_qr_customizada,
          
          // Calculated fields (using DB values if available, otherwise derived)
          calculos: {
            totalQS: Number(r.total_qs || 0),
            totalQR: Number(r.total_qr || 0),
            nrCiclos: derivedCalculations.nrCiclos,
            diasEtapaPaga: derivedCalculations.diasEtapaPaga,
            diasEtapaSolicitada: derivedCalculations.diasEtapaSolicitada,
            totalEtapas: derivedCalculations.totalEtapas,
            complementoQS: Number(r.complemento_qs || 0),
            etapaQS: Number(r.etapa_qs || 0),
            complementoQR: Number(r.complemento_qr || 0),
            etapaQR: Number(r.etapa_qr || 0),
          },
          
          // RACAO_OPERACIONAL fields
          quantidadeR2: r.quantidade_r2 || 0,
          quantidadeR3: r.quantidade_r3 || 0,
        };
      });

      setRegistros(registrosCarregados);
    } catch (error: any) {
      toast.error("Erro ao carregar registros");
    } finally {
      setLoading(false);
    }
  };

  // Calculations for RACAO_QUENTE preview
  const calculosRacaoQuente = useMemo(() => {
    if (selectedTab !== 'RACAO_QUENTE') return null;
    return calculateClasseICalculations(efetivo, diasOperacao, nrRefInt, valorQS, valorQR);
  }, [efetivo, diasOperacao, nrRefInt, valorQS, valorQR, selectedTab]);
  
  // Calculations for RACAO_OPERACIONAL preview
  const totalRacoesOperacionais = quantidadeR2 + quantidadeR3;

  const resetFormFields = () => {
    setSelectedOmId(undefined);
    setOrganizacao("");
    setUg("");
    setEfetivo(0);
    setDiasOperacao(0);
    setNrRefInt(1);
    setOmQS("");
    setUgQS("");
    setQuantidadeR2(0);
    setQuantidadeR3(0);
    setEditingRegistroId(null);
    setFasesAtividade(["Execução"]);
    setCustomFaseAtividade("");
    setSelectedTab('RACAO_QUENTE'); // Reset to default tab
    
    // Reset monetary inputs to current diretriz values
    if (diretrizAno) {
        loadDiretrizes(supabase.auth.getUser().then(res => res.data.user?.id || ''));
    } else {
        setRawQSInput(numberToRawDigits(9.0));
        setRawQRInput(numberToRawDigits(6.0));
        setValorQS(9.0);
        setValorQR(6.0);
    }
  };

  const handleOMChange = async (omData: OMData | undefined) => {
    if (omData) {
      setSelectedOmId(omData.id);
      setOrganizacao(omData.nome_om);
      setUg(omData.codug_om);
      
      // Define a RM de vinculação da OM como padrão para a RM que receberá o QS
      const defaultOmQS = omData.rm_vinculacao;
      const defaultUgQS = omData.codug_rm_vinculacao;
      
      setOmQS(defaultOmQS);
      setUgQS(defaultUgQS);
      
      // Tenta carregar dados existentes para esta OM
      const existingR1 = registros.find(r => r.organizacao === omData.nome_om && r.ug === omData.codug_om && r.categoria === 'RACAO_QUENTE');
      const existingR2 = registros.find(r => r.organizacao === omData.nome_om && r.ug === omData.codug_om && r.categoria === 'RACAO_OPERACIONAL');
      
      // Se houver registros, preenche os campos globais e os campos da aba ativa
      if (existingR1 || existingR2) {
          const primaryRecord = existingR1 || existingR2;
          setDiasOperacao(primaryRecord!.diasOperacao);
          setEfetivo(primaryRecord!.efetivo || 0);
          
          const fasesSalvas = (primaryRecord!.faseAtividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
          setFasesAtividade(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
          setCustomFaseAtividade(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
          
          // Preenche R1
          if (existingR1) {
              setOmQS(existingR1.omQS || defaultOmQS);
              setUgQS(existingR1.ugQS || defaultUgQS);
              setNrRefInt(existingR1.nrRefInt || 1);
              const qs = existingR1.valorQS || valorQS;
              const qr = existingR1.valorQR || valorQR;
              setValorQS(qs);
              setValorQR(qr);
              setRawQSInput(numberToRawDigits(qs));
              setRawQRInput(numberToRawDigits(qr));
          }
          
          // Preenche R2/R3
          if (existingR2) {
              setQuantidadeR2(existingR2.quantidadeR2 || 0);
              setQuantidadeR3(existingR2.quantidadeR3 || 0);
          }
          
          // Define o ID de edição para o primeiro registro encontrado (R1 tem prioridade)
          setEditingRegistroId(existingR1?.id || existingR2?.id || null);
          setSelectedTab(existingR1 ? 'RACAO_QUENTE' : 'RACAO_OPERACIONAL');
          
      } else {
          // Se não houver registros, reseta os campos específicos da categoria
          setDiasOperacao(0);
          setEfetivo(0);
          setNrRefInt(1);
          setQuantidadeR2(0);
          setQuantidadeR3(0);
          setEditingRegistroId(null);
          setFasesAtividade(["Execução"]);
          setCustomFaseAtividade("");
          setSelectedTab('RACAO_QUENTE');
          
          // Recarrega valores padrão de diretriz
          if (diretrizAno) {
              loadDiretrizes(supabase.auth.getUser().then(res => res.data.user?.id || ''));
          }
      }
      
    } else {
      resetFormFields();
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
  
  // Handler para inputs de preço (para permitir vírgula e formatação)
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'valorQS' | 'valorQR') => {
    const rawValue = e.target.value;
    const { numericValue, digits } = formatCurrencyInput(rawValue);
    
    if (field === 'valorQS') {
        setRawQSInput(digits);
        setValorQS(numericValue);
    } else {
        setRawQRInput(digits);
        setValorQR(numericValue);
    }
  };

  const handlePriceBlur = (field: 'valorQS' | 'valorQR') => {
    // Re-formata o input para garantir 2 casas decimais
    const numericValue = field === 'valorQS' ? valorQS : valorQR;
    
    if (field === 'valorQS') {
        setRawQSInput(numberToRawDigits(numericValue));
    } else {
        setRawQRInput(numberToRawDigits(numericValue));
    }
  };
  
  // Função para formatar o valor numérico para exibição no input
  const formatPriceForInput = (price: number, rawDigits: string): string => {
    if (rawDigits.length > 0) {
        return formatCurrencyInput(rawDigits).formatted;
    }
    return formatNumberForInput(price, 2);
  };


  const handleCadastrar = async () => {
    if (!ptrabId || !organizacao || !ug) {
      toast.error("Selecione uma OM e um P Trab válidos");
      return;
    }
    if (diasOperacao <= 0 || efetivo <= 0) {
      toast.error("Efetivo e Dias de Operação devem ser maiores que zero.");
      return;
    }

    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');

    if (!faseFinalString) {
      toast.error("Selecione ou digite pelo menos uma Fase da Atividade.");
      return;
    }
    
    setLoading(true);
    
    // 1. Encontrar ID existente para a OM/UG e CATEGORIA atual
    const existingRecord = registros.find(r => 
        r.organizacao === organizacao && 
        r.ug === ug && 
        r.categoria === selectedTab
    );
    const idToUpdate = existingRecord?.id;
    
    // 2. Preparar dados base
    let registroData: any = {
        p_trab_id: ptrabId,
        organizacao: organizacao,
        ug: ug,
        dias_operacao: diasOperacao,
        efetivo: efetivo,
        fase_atividade: faseFinalString,
        categoria: selectedTab,
        
        // Reset fields not used by the current category to ensure clean data
        om_qs: null, ug_qs: null, nr_ref_int: null, valor_qs: null, valor_qr: null,
        complemento_qs: 0, etapa_qs: 0, total_qs: 0, complemento_qr: 0, etapa_qr: 0, total_qr: 0, total_geral: 0,
        quantidade_r2: 0, quantidade_r3: 0,
    };

    if (selectedTab === 'RACAO_QUENTE') {
        if (!omQS || !ugQS) {
            toast.error("Selecione a RM que receberá o QS.");
            setLoading(false);
            return;
        }
        if (valorQS <= 0 || valorQR <= 0) {
            toast.error("Valores QS e QR devem ser maiores que zero.");
            setLoading(false);
            return;
        }
        
        const calculos = calculateClasseICalculations(efetivo, diasOperacao, nrRefInt, valorQS, valorQR);
        
        registroData = {
            ...registroData,
            om_qs: omQS,
            ug_qs: ugQS,
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
        };
        
        if (registroData.total_geral === 0) {
            toast.error("O cálculo da Ração Quente resultou em zero. Verifique Efetivo, Dias e Valores.");
            setLoading(false);
            return;
        }
        
    } else if (selectedTab === 'RACAO_OPERACIONAL') {
        if (quantidadeR2 <= 0 && quantidadeR3 <= 0) {
            toast.error("Informe a quantidade de Ração Operacional (R2 ou R3).");
            setLoading(false);
            return;
        }
        
        registroData = {
            ...registroData,
            quantidade_r2: quantidadeR2,
            quantidade_r3: quantidadeR3,
            // Total geral remains 0 for now, as requested (no monetary value)
        };
    }

    try {
      if (idToUpdate) {
        // Update: Preserva as memórias de cálculo customizadas se existirem
        const existingMemoria = registros.find(r => r.id === idToUpdate);
        
        const { error } = await supabase
          .from("classe_i_registros")
          .update({
              ...registroData,
              memoria_calculo_qs_customizada: existingMemoria?.memoriaQSCustomizada || null,
              memoria_calculo_qr_customizada: existingMemoria?.memoriaQRCustomizada || null,
          })
          .eq("id", idToUpdate);

        if (error) throw error;
        toast.success(`${selectedTab === 'RACAO_QUENTE' ? 'Ração Quente' : 'Ração Operacional'} atualizada com sucesso para ${organizacao}!`);
      } else {
        const { error } = await supabase
          .from("classe_i_registros")
          .insert([registroData]);

        if (error) throw error;
        toast.success(`${selectedTab === 'RACAO_QUENTE' ? 'Ração Quente' : 'Ração Operacional'} cadastrada com sucesso para ${organizacao}!`);
      }
      
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
    const registro = registros.find(r => r.id === id);
    if (!registro) return;
    
    const categoriaLabel = registro.categoria === 'RACAO_QUENTE' ? 'Ração Quente (QS/QR)' : 'Ração Operacional (R2/R3)';
    
    if (!confirm(`Tem certeza que deseja remover o registro de ${categoriaLabel} para a OM ${registro.organizacao}?`)) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("classe_i_registros")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setRegistros(registros.filter((r) => r.id !== id));
      toast.success("Registro removido com sucesso!");
      
      // Se o registro removido era o que estava sendo editado, reseta o formulário
      if (editingRegistroId === id) {
          resetFormFields();
      }
      
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEditRegistro = async (registro: ClasseIRegistro) => {
    setEditingRegistroId(registro.id);
    setSelectedTab(registro.categoria);
    
    // 1. Set Global Fields
    setOrganizacao(registro.organizacao);
    setUg(registro.ug);
    setEfetivo(registro.efetivo || 0);
    setDiasOperacao(registro.diasOperacao);
    
    const fasesSalvas = (registro.faseAtividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    setFasesAtividade(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");

    // 2. Set Category Specific Fields
    if (registro.categoria === 'RACAO_QUENTE') {
        setOmQS(registro.omQS || "");
        setUgQS(registro.ugQS || "");
        setNrRefInt(registro.nrRefInt || 1);
        const qs = registro.valorQS || valorQS;
        const qr = registro.valorQR || valorQR;
        setValorQS(qs);
        setValorQR(qr);
        setRawQSInput(numberToRawDigits(qs));
        setRawQRInput(numberToRawDigits(qr));
        setQuantidadeR2(0);
        setQuantidadeR3(0);
    } else if (registro.categoria === 'RACAO_OPERACIONAL') {
        setOmQS("");
        setUgQS("");
        setNrRefInt(1);
        setValorQS(9.0);
        setValorQR(6.0);
        setRawQSInput(numberToRawDigits(9.0));
        setRawQRInput(numberToRawDigits(6.0));
        setQuantidadeR2(registro.quantidadeR2 || 0);
        setQuantidadeR3(registro.quantidadeR3 || 0);
    }

    // 3. Find OM ID for OmSelector
    try {
      const { data: omData, error: omError } = await supabase
        .from('organizacoes_militares')
        .select('id')
        .eq('nome_om', registro.organizacao)
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

  const handleIniciarEdicaoMemoria = (registro: ClasseIRegistro) => {
    if (registro.categoria !== 'RACAO_QUENTE') {
        toast.warning("Memória de cálculo não aplicável para Ração Operacional.");
        return;
    }
    
    const { qs, qr } = generateRacaoQuenteMemoriaCalculo(registro);
    
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

  const totalGeralQS = registros.filter(r => r.categoria === 'RACAO_QUENTE').reduce((sum, r) => sum + r.calculos.totalQS, 0);
  const totalGeralQR = registros.filter(r => r.categoria === 'RACAO_QUENTE').reduce((sum, r) => sum + r.calculos.totalQR, 0);
  const totalGeral = totalGeralQS + totalGeralQR;
  
  const totalRacoesOperacionaisGeral = registros.filter(r => r.categoria === 'RACAO_OPERACIONAL').reduce((sum, r) => sum + (r.quantidadeR2 || 0) + (r.quantidadeR3 || 0), 0);

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

        <Card className="p-6 backdrop-blur-sm bg-card/95 border-primary/10 max-w-6xl mx-auto">
          <div className="mb-4">
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Classe I - Subsistência
            </h1>
            <p className="text-muted-foreground">
              Configure a sua necessidade de alimentação (Ração Quente e Ração Operacional) por OM.
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleCadastrar(); }} className="space-y-6">
            
            {/* 1. Dados da Organização */}
            <div className="space-y-3 border-b pb-4">
              <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
              
              <div className="space-y-6 p-4 bg-muted/30 rounded-lg">
                
                {/* Linha 1: OM Destino (QR / Ração Operacional) e UG Destino */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="om">OM de Destino (QR / Ração Operacional) *</Label>
                    <OmSelector
                      selectedOmId={selectedOmId}
                      onChange={handleOMChange}
                      placeholder="Selecione uma OM de Destino..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ug">UG de Destino</Label>
                    <Input
                      id="ug"
                      value={ug}
                      readOnly
                      disabled={true}
                      className="disabled:opacity-60"
                    />
                  </div>
                </div>
                
                {/* Linha 2: Efetivo, Dias de Atividade, Fase da Atividade */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="efetivo">Efetivo de Militares *</Label>
                    <Input
                      id="efetivo"
                      type="number"
                      min="1"
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={efetivo === 0 ? "" : efetivo.toString()}
                      onChange={(e) => setEfetivo(Number(e.target.value))}
                      placeholder="Ex: 246"
                      onKeyDown={handleEnterToNextField}
                      disabled={!organizacao}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="diasOperacao">Dias de Atividade *</Label>
                    <Input
                      id="diasOperacao"
                      type="number"
                      min="1"
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={diasOperacao === 0 ? "" : diasOperacao.toString()}
                      onChange={(e) => setDiasOperacao(Number(e.target.value))}
                      placeholder="Ex: 30"
                      onKeyDown={handleEnterToNextField}
                      disabled={!organizacao}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="faseAtividade">Fase da Atividade *</Label>
                    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          type="button"
                          className="w-full justify-between"
                          disabled={!organizacao}
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
              </div>
            </div>

            {/* 3. Tabela de Registros */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-accent" />
                    Registros Cadastrados
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
                          <th className="text-left p-3 font-semibold text-sm w-[15%]">OM Destino</th>
                          <th className="text-center p-3 font-semibold text-sm w-[10%]">UG</th>
                          <th className="text-center p-3 font-semibold text-sm w-[15%]">Categoria</th>
                          <th className="text-center p-3 font-semibold text-sm w-[8%]">Efetivo</th>
                          <th className="text-center p-3 font-semibold text-sm w-[8%]">Dias</th>
                          <th className="text-right p-3 font-semibold text-sm w-[12%]">Total QS/R2</th>
                          <th className="text-right p-3 font-semibold text-sm w-[12%]">Total QR/R3</th>
                          <th className="text-right p-3 font-semibold text-sm w-[12%]">Total Geral</th>
                          <th className="text-center p-3 font-semibold text-sm w-[8%]">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registros.map((registro) => {
                          const isRacaoQuente = registro.categoria === 'RACAO_QUENTE';
                          const totalQS_R2 = isRacaoQuente ? registro.calculos.totalQS : (registro.quantidadeR2 || 0);
                          const totalQR_R3 = isRacaoQuente ? registro.calculos.totalQR : (registro.quantidadeR3 || 0);
                          const totalGeralRegistro = isRacaoQuente ? (registro.calculos.totalQS + registro.calculos.totalQR) : (totalQS_R2 + totalQR_R3);
                          
                          return (
                            <tr key={registro.id} className="border-t hover:bg-muted/50">
                              <td className="p-3 text-sm">{registro.organizacao}</td>
                              <td className="p-3 text-sm text-center">{registro.ug}</td>
                              <td className="p-3 text-sm text-center">
                                <Badge variant="outline" className={cn(
                                    isRacaoQuente ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                                )}>
                                    {isRacaoQuente ? 'Ração Quente (R1)' : 'Ração Operacional (R2/R3)'}
                                </Badge>
                              </td>
                              <td className="p-3 text-sm text-center">{registro.efetivo}</td>
                              <td className="p-3 text-sm text-center">{registro.diasOperacao}</td>
                              <td className="p-3 px-4 text-sm text-right font-medium whitespace-nowrap">
                                {isRacaoQuente ? formatCurrency(totalQS_R2) : `${formatNumber(totalQS_R2)} un.`}
                              </td>
                              <td className="p-3 px-4 text-sm text-right font-medium whitespace-nowrap">
                                {isRacaoQuente ? formatCurrency(totalQR_R3) : `${formatNumber(totalQR_R3)} un.`}
                              </td>
                              <td className="p-3 px-4 text-sm text-right font-bold whitespace-nowrap">
                                {isRacaoQuente ? formatCurrency(totalGeralRegistro) : `${formatNumber(totalGeralRegistro)} un.`}
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
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-muted/50 border-t-2">
                        <tr>
                          <td colSpan={5} className="p-3 text-right text-sm font-semibold">
                            TOTAL GERAL (Ração Quente):
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
                        <tr>
                          <td colSpan={5} className="p-3 text-right text-sm font-semibold">
                            TOTAL GERAL (Ração Operacional):
                          </td>
                          <td colSpan={3} className="p-3 px-4 text-sm text-right font-extrabold text-secondary text-base whitespace-nowrap">
                            {formatNumber(totalRacoesOperacionaisGeral)} un.
                          </td>
                          <td className="p-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Detalhamento das Memórias de Cálculo */}
                <div className="space-y-4 mt-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    📋 Memórias de Cálculo Detalhadas
                  </h3>
                  
                  {registros.map((registro) => {
                    const isRacaoQuente = registro.categoria === 'RACAO_QUENTE';
                    const isEditing = editingMemoriaId === registro.id;
                    const hasCustomMemoria = isRacaoQuente && !!(registro.memoriaQSCustomizada || registro.memoriaQRCustomizada);
                    
                    let memoriaQSFinal = "";
                    let memoriaQRFinal = "";
                    let memoriaOperacionalFinal = "";
                    
                    if (isRacaoQuente) {
                        const { qs, qr } = generateRacaoQuenteMemoriaCalculo(registro);
                        memoriaQSFinal = isEditing ? memoriaQSEdit : (registro.memoriaQSCustomizada || qs);
                        memoriaQRFinal = isEditing ? memoriaQREdit : (registro.memoriaQRCustomizada || qr);
                    } else {
                        memoriaOperacionalFinal = generateRacaoOperacionalMemoriaCalculo(registro);
                    }
                    
                    return (
                      <Card key={registro.id} className="p-6 bg-muted/30">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-semibold text-foreground">
                              {registro.organizacao} (UG: {registro.ug})
                            </h4>
                            <Badge variant="default" className={cn(
                                isRacaoQuente ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                            )}>
                                {isRacaoQuente ? 'Ração Quente (R1)' : 'Ração Operacional (R2/R3)'}
                            </Badge>
                            {hasCustomMemoria && !isEditing && (
                              <Badge variant="outline" className="text-xs">
                                Editada manualmente
                              </Badge>
                            )}
                          </div>
                          
                          {isRacaoQuente && (
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
                          )}
                        </div>
                        <div className="h-px bg-border my-4" /> 
                        
                        {isRacaoQuente ? (
                            <>
                                {/* Bloco QS */}
                                <div className="space-y-2 mb-6">
                                  <h5 className="font-bold text-sm text-blue-600">QS - Quantitativo de Subsistência (RM: {registro.omQS})</h5>
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
                                  <h5 className="font-bold text-sm text-green-600">QR - Quantitativo de Rancho (OM: {registro.organizacao})</h5>
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
                            </>
                        ) : (
                            /* Bloco Ração Operacional */
                            <div className="space-y-2">
                              <h5 className="font-bold text-sm text-secondary">Ração Operacional (R2/R3)</h5>
                              <Card className="p-4 bg-background rounded-lg border">
                                <Textarea
                                  value={memoriaOperacionalFinal}
                                  readOnly
                                  rows={8}
                                  className="font-mono text-xs whitespace-pre-wrap text-foreground"
                                />
                              </Card>
                            </div>
                        )}
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