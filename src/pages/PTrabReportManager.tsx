import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FileText, Package, Utensils, Briefcase, HardHat, Plane, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PTrabLogisticoReport from "@/components/reports/PTrabLogisticoReport";
import PTrabRacaoOperacionalReport from "@/components/reports/PTrabRacaoOperacionalReport";

// =================================================================
// TIPOS E FUNÇÕES AUXILIARES (Exportados para uso nos relatórios)
// =================================================================

export interface PTrabData {
  id: string;
  numero_ptrab: string;
  comando_militar_area: string;
  nome_om: string;
  nome_om_extenso?: string;
  nome_operacao: string;
  periodo_inicio: string;
  periodo_fim: string;
  efetivo_empregado: string;
  acoes: string;
  status: string;
  nome_cmt_om?: string;
  local_om?: string;
  updated_at: string; // NOVO: Data de última atualização
}

export interface ClasseIRegistro {
  id: string;
  organizacao: string;
  ug: string;
  om_qs: string;
  ug_qs: string;
  efetivo: number;
  dias_operacao: number;
  nr_ref_int: number;
  valor_qs: number;
  valor_qr: number;
  complemento_qs: number;
  etapa_qs: number;
  total_qs: number;
  total_qr: number;
  total_geral: number;
  memoria_calculo_qs_customizada?: string | null;
  memoria_calculo_qr_customizada?: string | null;
  fase_atividade?: string | null;
  categoria: 'RACAO_QUENTE' | 'RACAO_OPERACIONAL';
  quantidade_r2: number;
  quantidade_r3: number;
}

export interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
  memoria_customizada?: string | null;
}

export interface ItemClasseIX {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  valor_acionamento_mensal: number;
  categoria: string;
}

export interface ClasseIIRegistro {
  id: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  categoria: string;
  itens_equipamentos: ItemClasseII[];
  valor_total: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string | null;
  valor_nd_30: number;
  valor_nd_39: number;
  animal_tipo?: 'Equino' | 'Canino';
  quantidade_animais?: number;
  itens_motomecanizacao?: ItemClasseIX[];
}

export interface ClasseIIIRegistro {
  id: string;
  tipo_equipamento: string;
  organizacao: string;
  ug: string;
  quantidade: number;
  potencia_hp?: number;
  horas_dia?: number;
  dias_operacao: number;
  consumo_hora?: number;
  consumo_km_litro?: number;
  km_dia?: number;
  tipo_combustivel: string;
  preco_litro: number;
  tipo_equipamento_detalhe?: string;
  total_litros: number;
  valor_total: number;
  detalhamento?: string;
  detalhamento_customizado?: string | null;
}

export interface LinhaTabela {
  registro: ClasseIRegistro;
  tipo: 'QS' | 'QR';
}

export interface LinhaClasseII {
  registro: ClasseIIRegistro;
}

export interface LinhaLubrificante {
  registro: ClasseIIIRegistro;
}

export interface GrupoOM {
  linhasQS: LinhaTabela[];
  linhasQR: LinhaTabela[];
  linhasClasseII: LinhaClasseII[];
  linhasClasseV: LinhaClasseII[];
  linhasClasseVI: LinhaClasseII[];
  linhasClasseVII: LinhaClasseII[];
  linhasClasseVIII: LinhaClasseII[];
  linhasClasseIX: LinhaClasseII[];
  linhasLubrificante: LinhaLubrificante[];
}

export const CLASSE_V_CATEGORIES = ["Armt L", "Armt P", "IODCT", "DQBRN"];
export const CLASSE_VI_CATEGORIES = ["Embarcação", "Equipamento de Engenharia"];
export const CLASSE_VII_CATEGORIES = ["Comunicações", "Informática"];
export const CLASSE_VIII_CATEGORIES = ["Saúde", "Remonta/Veterinária"];
export const CLASSE_IX_CATEGORIES = ["Vtr Administrativa", "Vtr Operacional", "Motocicleta", "Vtr Blindada"];

export const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR');
};

export const calculateDays = (inicio: string, fim: string) => {
  const start = new Date(inicio);
  const end = new Date(fim);
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
};

export const formatFasesParaTexto = (faseCSV: string | null | undefined): string => {
  if (!faseCSV) return 'operação';
  
  const fases = faseCSV.split(';').map(f => f.trim()).filter(f => f);
  
  if (fases.length === 0) return 'operação';
  if (fases.length === 1) return fases[0];
  if (fases.length === 2) return `${fases[0]} e ${fases[1]}`;
  
  const ultimaFase = fases[fases.length - 1];
  const demaisFases = fases.slice(0, -1).join(', ');
  return `${demaisFases} e ${ultimaFase}`;
};

export const getClasseIILabel = (categoria: string): string => {
    if (CLASSE_V_CATEGORIES.includes(categoria)) {
        return 'CLASSE V - ARMAMENTO';
    }
    if (CLASSE_VI_CATEGORIES.includes(categoria)) {
        return 'CLASSE VI - MATERIAL DE ENGENHARIA';
    }
    if (CLASSE_VII_CATEGORIES.includes(categoria)) {
        return 'CLASSE VII - COMUNICAÇÕES E INFORMÁTICA';
    }
    if (CLASSE_VIII_CATEGORIES.includes(categoria)) {
        return 'CLASSE VIII - SAÚDE E REMONTA/VETERINÁRIA';
    }
    if (CLASSE_IX_CATEGORIES.includes(categoria)) {
        return 'CLASSE IX - MOTOMECANIZAÇÃO';
    }
    return 'CLASSE II - MATERIAL DE INTENDÊNCIA';
};

export const calculateItemTotalClasseIX = (item: ItemClasseIX, diasOperacao: number): { base: number, acionamento: number, total: number } => {
    const nrVtr = item.quantidade;
    const valorDia = item.valor_mnt_dia;
    const valorMensal = item.valor_acionamento_mensal;
    
    if (nrVtr <= 0 || diasOperacao <= 0) {
        return { base: 0, acionamento: 0, total: 0 };
    }
    
    const custoBase = nrVtr * valorDia * diasOperacao;
    const nrMeses = Math.ceil(diasOperacao / 30);
    const custoAcionamento = nrVtr * valorMensal * nrMeses;
    
    const total = custoBase + custoAcionamento;
    
    return { base: custoBase, acionamento: custoAcionamento, total };
};

export const generateClasseIXMemoriaCalculo = (registro: ClasseIIRegistro): string => {
    if (registro.detalhamento_customizado) {
      return registro.detalhamento_customizado;
    }
    
    const itens = (registro.itens_motomecanizacao || []) as ItemClasseIX[];
    const diasOperacao = registro.dias_operacao;
    const organizacao = registro.organizacao;
    const ug = registro.ug;
    const faseAtividade = registro.fase_atividade;
    const valorND30 = registro.valor_nd_30;
    const valorND39 = registro.valor_nd_39;
    
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const valorTotalFinal = valorND30 + valorND39;

    let totalItens = 0;

    const gruposPorCategoria = itens.reduce((acc, item) => {
        const categoria = item.categoria;
        const { base, acionamento, total } = calculateItemTotalClasseIX(item, diasOperacao);
        
        if (!acc[categoria]) {
            acc[categoria] = {
                totalValorBase: 0,
                totalValorAcionamento: 0,
                totalQuantidade: 0,
                detalhes: [],
            };
        }
        
        acc[categoria].totalValorBase += base;
        acc[categoria].totalValorAcionamento += acionamento;
        acc[categoria].totalQuantidade += item.quantidade;
        totalItens += item.quantidade;
        
        const nrMeses = Math.ceil(diasOperacao / 30);

        acc[categoria].detalhes.push(
            `- ${item.quantidade} ${item.item} (Base: ${formatCurrency(base)}, Acionamento: ${formatCurrency(acionamento)} em ${nrMeses} meses) = ${formatCurrency(total)}.`
        );
        
        return acc;
    }, {} as Record<string, { totalValorBase: number, totalValorAcionamento: number, totalQuantidade: number, detalhes: string[] }>);

    let detalhamentoItens = "";
    
    Object.entries(gruposPorCategoria).forEach(([categoria, grupo]) => {
        const totalCategoria = grupo.totalValorBase + grupo.totalValorAcionamento;

        detalhamentoItens += `\n--- ${getClasseIILabel(categoria).toUpperCase()} (${grupo.totalQuantidade} VTR) ---\n`;
        detalhamentoItens += `Valor Total Categoria: ${formatCurrency(totalCategoria)}\n`;
        detalhamentoItens += `Detalhes:\n`;
        detalhamentoItens += grupo.detalhes.join('\n');
        detalhamentoItens += `\n`;
    });
    
    detalhamentoItens = detalhamentoItens.trim();

    return `33.90.30 / 33.90.39 - Aquisição de Material de Classe IX (Motomecanização) para ${totalItens} viaturas, durante ${diasOperacao} dias de ${faseFormatada}, para ${organizacao}.
Recurso destinado à OM proprietária: ${organizacao} (UG: ${ug})

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Fórmula Base: (Nr Vtr x Valor Mnt/Dia x Nr Dias) + (Nr Vtr x Valor Acionamento/Mês x Nr Meses).

${detalhamentoItens}

Valor Total Solicitado: ${formatCurrency(valorTotalFinal)}.`;
};

export const generateClasseIMemoriaCalculo = (registro: ClasseIRegistro): { qs: string, qr: string } => {
    const { 
      organizacao, ug, om_qs, ug_qs, efetivo, dias_operacao, nr_ref_int, 
      valor_qs, valor_qr, complemento_qs, etapa_qs, total_qs, 
      complemento_qr, etapa_qr, total_qr, fase_atividade 
    } = registro;
    
    const diasRestantesNoCiclo = dias_operacao % 30;
    const ciclosCompletos = Math.floor(dias_operacao / 30);
    
    let diasEtapaSolicitada = 0;
    if (diasRestantesNoCiclo <= 22 && dias_operacao >= 30) {
      diasEtapaSolicitada = ciclosCompletos * 8;
    } else if (diasRestantesNoCiclo > 22) {
      diasEtapaSolicitada = (diasRestantesNoCiclo - 22) + (ciclosCompletos * 8);
    } else {
      diasEtapaSolicitada = 0;
    }
    
    const faseFormatada = formatFasesParaTexto(fase_atividade);
    
    // Memória QS
    const memoriaQS = `33.90.30 - Aquisição de Gêneros Alimentícios (QS) destinados à complementação de alimentação de ${efetivo} militares do ${organizacao}, durante ${dias_operacao} dias de ${faseFormatada}.
OM Fornecedora: ${om_qs} (UG: ${ug_qs})

Cálculo:
- Valor da Etapa (QS): ${formatCurrency(valor_qs)}.
- Nr Refeições Intermediárias: ${nr_ref_int}.

Fórmula: [Efetivo empregado x Nr Ref Int (máx 3) x Valor da Etapa/3 x Nr de dias de complemento] + [Efetivo empregado x Valor da etapa x Nr de dias de etapa completa solicitada.]

- [${efetivo} militares do ${organizacao} x ${nr_ref_int} Ref Int x (${formatCurrency(valor_qs)}/3) x ${dias_operacao} dias de atividade] = ${formatCurrency(complemento_qs)}.
- [${efetivo} militares do ${organizacao} x ${formatCurrency(valor_qs)} x ${diasEtapaSolicitada} dias de etapa completa solicitada] = ${formatCurrency(etapa_qs)}.

Total QS: ${formatCurrency(total_qs)}.`;

    // Memória QR
    const memoriaQR = `33.90.30 - Aquisição de Gêneros Alimentícios (QR - Rancho Pronto) destinados à complementação de alimentação de ${efetivo} militares do ${organizacao}, durante ${dias_operacao} dias de ${faseFormatada}.
OM de Destino: ${organizacao} (UG: ${ug})

Cálculo:
- Valor da Etapa (QR): ${formatCurrency(valor_qr)}.
- Nr Refeições Intermediárias: ${nr_ref_int}.

Fórmula: [Efetivo empregado x Nr Ref Int (máx 3) x Valor da Etapa/3 x Nr de dias de complemento] + [Efetivo empregado x Valor da etapa x Nr de dias de etapa completa solicitada.]

- [${efetivo} militares do ${organizacao} x ${nr_ref_int} Ref Int x (${formatCurrency(valor_qr)}/3) x ${dias_operacao} dias de atividade] = ${formatCurrency(complemento_qr)}.
- [${efetivo} militares do ${organizacao} x ${formatCurrency(valor_qr)} x ${diasEtapaSolicitada} dias de etapa completa solicitada] = ${formatCurrency(etapa_qr)}.

Total QR: ${formatCurrency(total_qr)}.`;

    return { qs: memoriaQS, qr: memoriaQR };
  };

export const generateClasseIIMemoriaCalculo = (registro: ClasseIIRegistro): string => {
    if (registro.detalhamento_customizado) {
      return registro.detalhamento_customizado;
    }
    
    if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
        return generateClasseIXMemoriaCalculo(registro);
    }
    
    return registro.detalhamento;
};

// =================================================================
// DEFINIÇÃO DOS RELATÓRIOS E RÓTULOS
// =================================================================

type ReportType = 
  'logistico' | 
  'racao_operacional' | 
  'operacional' | 
  'material_permanente' | 
  'hora_voo' | 
  'dor';

interface ReportOption {
    value: ReportType;
    label: string;
    icon: React.FC<any>;
    iconClass: string;
    fileSuffix: string; // NOVO CAMPO
}

const REPORT_OPTIONS: ReportOption[] = [
  { value: 'logistico', label: 'P Trab Logístico', icon: Package, iconClass: 'text-orange-500', fileSuffix: 'Aba Log' },
  { value: 'racao_operacional', label: 'P Trab Cl I - Ração Operacional', icon: Utensils, iconClass: 'text-orange-500', fileSuffix: 'Aba Rç Op' },
  { value: 'operacional', label: 'P Trab Operacional', icon: Briefcase, iconClass: 'text-blue-500', fileSuffix: 'Aba Op' },
  { value: 'material_permanente', label: 'P Trab Material Permanente', icon: HardHat, iconClass: 'text-green-500', fileSuffix: 'Aba Mat Perm' },
  { value: 'hora_voo', label: 'P Trab Hora de Voo', icon: Plane, iconClass: 'text-purple-500', fileSuffix: 'Aba HV' },
  { value: 'dor', label: 'DOR', icon: ClipboardList, iconClass: 'text-gray-500', fileSuffix: 'Aba DOR' },
];

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

const PTrabReportManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const ptrabId = searchParams.get('ptrabId');
  
  const [ptrabData, setPtrabData] = useState<PTrabData | null>(null);
  const [registrosClasseI, setRegistrosClasseI] = useState<ClasseIRegistro[]>([]);
  const [registrosClasseII, setRegistrosClasseII] = useState<ClasseIIRegistro[]>([]);
  const [registrosClasseIII, setRegistrosClasseIII] = useState<ClasseIIIRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportType>('logistico');

  const [showCompleteStatusDialog, setShowCompleteStatusDialog] = useState(false);

  const isLubrificante = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'LUBRIFICANTE_GERADOR' || r.tipo_equipamento === 'LUBRIFICANTE_EMBARCACAO' || r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
  const isCombustivel = (r: ClasseIIIRegistro) => !isLubrificante(r);
  
  const currentReportOption = useMemo(() => REPORT_OPTIONS.find(r => r.value === selectedReport)!, [selectedReport]);

  const loadData = useCallback(async () => {
    if (!ptrabId) {
      toast({ title: "Erro", description: "P Trab não selecionado", variant: "destructive" });
      navigate('/ptrab');
      return;
    }

    setLoading(true);
    
    try {
      const { data: ptrab, error: ptrabError } = await supabase
        .from('p_trab')
        .select('*, updated_at') // Incluir updated_at
        .eq('id', ptrabId)
        .single();

      if (ptrabError || !ptrab) throw new Error("Não foi possível carregar o P Trab");

      const { data: classeIData } = await supabase
        .from('classe_i_registros')
        .select('*, memoria_calculo_qs_customizada, memoria_calculo_qr_customizada, fase_atividade, categoria, quantidade_r2, quantidade_r3')
        .eq('p_trab_id', ptrabId);
      
      const [
        { data: classeIIData },
        { data: classeVData },
        { data: classeVIData },
        { data: classeVIIData },
        { data: classeVIIISaudeData },
        { data: classeVIIIRemontaData },
        { data: classeIXData },
        { data: classeIIIData },
      ] = await Promise.all([
        supabase.from('classe_ii_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39').eq('p_trab_id', ptrabId),
        supabase.from('classe_v_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39').eq('p_trab_id', ptrabId),
        supabase.from('classe_vi_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39').eq('p_trab_id', ptrabId),
        supabase.from('classe_vii_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39').eq('p_trab_id', ptrabId),
        supabase.from('classe_viii_saude_registros').select('*, itens_saude, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39').eq('p_trab_id', ptrabId),
        supabase.from('classe_viii_remonta_registros').select('*, itens_remonta, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, animal_tipo, quantidade_animais').eq('p_trab_id', ptrabId),
        supabase.from('classe_ix_registros').select('*, itens_motomecanizacao, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39').eq('p_trab_id', ptrabId),
        supabase.from('classe_iii_registros').select('*, detalhamento_customizado').eq('p_trab_id', ptrabId),
      ]);

      const allClasseItems = [
        ...(classeIIData || []),
        ...(classeVData || []),
        ...(classeVIData || []),
        ...(classeVIIData || []),
        ...(classeVIIISaudeData || []).map(r => ({ ...r, itens_equipamentos: r.itens_saude, categoria: 'Saúde' })),
        ...(classeVIIIRemontaData || []).map(r => ({ ...r, itens_equipamentos: r.itens_remonta, categoria: 'Remonta/Veterinária', animal_tipo: r.animal_tipo, quantidade_animais: r.quantidade_animais })),
        ...(classeIXData || []).map(r => ({ ...r, itens_equipamentos: r.itens_motomecanizacao, categoria: r.categoria })),
      ];

      setPtrabData(ptrab as PTrabData); // Casting para incluir updated_at
      setRegistrosClasseI((classeIData || []).map(r => ({
          ...r,
          categoria: (r.categoria || 'RACAO_QUENTE') as 'RACAO_QUENTE' | 'RACAO_OPERACIONAL',
          quantidade_r2: r.quantidade_r2 || 0,
          quantidade_r3: r.quantidade_r3 || 0,
      })) as ClasseIRegistro[]);
      setRegistrosClasseII(allClasseItems as ClasseIIRegistro[]);
      setRegistrosClasseIII(classeIIIData || []);
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({ title: "Erro", description: "Não foi possível carregar os dados do P Trab.", variant: "destructive" });
      navigate('/ptrab');
    } finally {
      setLoading(false);
    }
  }, [ptrabId, navigate, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportSuccess = () => {
    if (ptrabData && (ptrabData.status === 'em_andamento' || ptrabData.status === 'aprovado')) {
      setShowCompleteStatusDialog(true);
    } else {
      // Não redireciona, apenas fecha o diálogo se não houver mudança de status
    }
  };

  const handleConfirmCompleteStatus = async () => {
    if (!ptrabData) return;

    try {
      const { error } = await supabase
        .from("p_trab")
        .update({ status: "arquivado" })
        .eq("id", ptrabData.id);

      if (error) throw error;

      toast({
        title: "Status atualizado!",
        description: `O status do P Trab ${ptrabData.numero_ptrab} foi alterado para "Arquivado".`,
        duration: 3000,
      });
      navigate('/ptrab');
    } catch (error) {
      console.error("Erro ao atualizar status para arquivado:", error);
      toast({
        title: "Erro ao atualizar status",
        description: "Não foi possível alterar o status do P Trab.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setShowCompleteStatusDialog(false);
    }
  };

  const handleCancelCompleteStatus = () => {
    setShowCompleteStatusDialog(false);
    navigate('/ptrab');
  };
  
  // --- LÓGICA DE AGRUPAMENTO E CÁLCULO (Mantida no Manager para ser passada aos relatórios) ---
  const gruposPorOM = useMemo(() => {
    const grupos: Record<string, GrupoOM> = {};
    const initializeGroup = (name: string) => {
        if (!grupos[name]) {
            grupos[name] = { 
                linhasQS: [], linhasQR: [], linhasClasseII: [], linhasClasseV: [],
                linhasClasseVI: [], linhasClasseVII: [], linhasClasseVIII: [], linhasClasseIX: [],
                linhasLubrificante: [] 
            };
        }
    };

    // 1. Processar Classe I (Apenas Ração Quente para a tabela principal)
    registrosClasseI.filter(r => r.categoria === 'RACAO_QUENTE').forEach((registro) => {
        initializeGroup(registro.om_qs);
        grupos[registro.om_qs].linhasQS.push({ registro, tipo: 'QS' });
        initializeGroup(registro.organizacao);
        grupos[registro.organizacao].linhasQR.push({ registro, tipo: 'QR' });
    });
    
    // 2. Processar Classes II, V, VI, VII, VIII, IX
    registrosClasseII.forEach((registro) => {
        initializeGroup(registro.organizacao);
        const omGroup = grupos[registro.organizacao];
        
        if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseV.push({ registro });
        } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseVI.push({ registro });
        } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseVII.push({ registro });
        } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseVIII.push({ registro });
        } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseIX.push({ registro });
        } else {
            omGroup.linhasClasseII.push({ registro });
        }
    });

    // 3. Processar Classe III Lubrificante
    registrosClasseIII.forEach((registro) => {
        if (isLubrificante(registro)) {
            initializeGroup(registro.organizacao);
            grupos[registro.organizacao].linhasLubrificante.push({ registro });
        }
    });
    
    return grupos;
  }, [registrosClasseI, registrosClasseII, registrosClasseIII]);
  
  const nomeRM = useMemo(() => {
    const oms = Object.keys(gruposPorOM);
    return oms.find(om => om.includes('RM') || om.includes('R M')) || ptrabData?.nome_om || '';
  }, [gruposPorOM, ptrabData]);

  const omsOrdenadas = useMemo(() => {
    return Object.keys(gruposPorOM).sort((a, b) => {
        const aTemRM = a.includes('RM') || a.includes('R M');
        const bTemRM = b.includes('RM') || b.includes('R M');
        
        if (aTemRM && !bTemRM) return -1;
        if (!aTemRM && bTemRM) return 1;
        return a.localeCompare(b);
    });
  }, [gruposPorOM]);
  
  const calcularTotaisPorOM = useCallback((grupo: GrupoOM, nomeOM: string) => {
    const totalQS = grupo.linhasQS.reduce((acc, linha) => acc + linha.registro.total_qs, 0);
    const totalQR = grupo.linhasQR.reduce((acc, linha) => acc + linha.registro.total_qr, 0);
    
    const totalClasseII_ND30 = grupo.linhasClasseII.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseII_ND39 = grupo.linhasClasseII.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseV_ND30 = grupo.linhasClasseV.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseV_ND39 = grupo.linhasClasseV.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseVI_ND30 = grupo.linhasClasseVI.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseVI_ND39 = grupo.linhasClasseVI.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseVII_ND30 = grupo.linhasClasseVII.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseVII_ND39 = grupo.linhasClasseVII.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseVIII_ND30 = grupo.linhasClasseVIII.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseVIII_ND39 = grupo.linhasClasseVIII.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseIX_ND30 = grupo.linhasClasseIX.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseIX_ND39 = grupo.linhasClasseIX.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalLubrificante = grupo.linhasLubrificante.reduce((acc, linha) => acc + linha.registro.valor_total, 0);
    
    const total_33_90_30 = totalQS + totalQR + 
                           totalClasseII_ND30 + totalClasseV_ND30 + totalClasseVI_ND30 + totalClasseVII_ND30 + totalClasseVIII_ND30 + totalClasseIX_ND30 +
                           totalLubrificante; 
    
    const total_33_90_39 = totalClasseII_ND39 + totalClasseV_ND39 + totalClasseVI_ND39 + totalClasseVII_ND39 + totalClasseVIII_ND39 + totalClasseIX_ND39;
    
    const total_parte_azul = total_33_90_30 + total_33_90_39;
    
    const classeIIIDestaOM = (nomeOM === nomeRM) 
      ? registrosClasseIII.filter(isCombustivel)
      : [];
    
    const valorDiesel = classeIIIDestaOM
      .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
      .reduce((acc, reg) => acc + reg.valor_total, 0);
    const valorGasolina = classeIIIDestaOM
      .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
      .reduce((acc, reg) => acc + reg.valor_total, 0);
    
    const totalCombustivel = valorDiesel + valorGasolina;
    
    const total_gnd3 = total_parte_azul + totalCombustivel; 
    
    const totalDieselLitros = classeIIIDestaOM
      .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
      .reduce((acc, reg) => acc + reg.total_litros, 0);
    const totalGasolinaLitros = classeIIIDestaOM
      .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
      .reduce((acc, reg) => acc + reg.total_litros, 0);

    return {
      total_33_90_30,
      total_33_90_39,
      total_parte_azul,
      total_combustivel: totalCombustivel,
      total_gnd3,
      totalDieselLitros,
      totalGasolinaLitros,
      valorDiesel,
      valorGasolina,
    };
  }, [registrosClasseIII, nomeRM]);
  // --- FIM LÓGICA DE AGRUPAMENTO E CÁLCULO ---

  const renderReport = () => {
    if (!ptrabData) return null;

    // Passa o fileSuffix para o componente filho
    const fileSuffix = currentReportOption.fileSuffix;

    switch (selectedReport) {
      case 'logistico':
        return (
          <PTrabLogisticoReport
            ptrabData={ptrabData}
            registrosClasseI={registrosClasseI}
            registrosClasseII={registrosClasseII}
            registrosClasseIII={registrosClasseIII}
            nomeRM={nomeRM}
            omsOrdenadas={omsOrdenadas}
            gruposPorOM={gruposPorOM}
            calcularTotaisPorOM={calcularTotaisPorOM}
            onExportSuccess={handleExportSuccess}
            showCompleteStatusDialog={showCompleteStatusDialog}
            setShowCompleteStatusDialog={setShowCompleteStatusDialog}
            handleConfirmCompleteStatus={handleConfirmCompleteStatus}
            handleCancelCompleteStatus={handleCancelCompleteStatus}
            fileSuffix={fileSuffix} // NOVO PROP
          />
        );
      case 'racao_operacional':
        return (
          <PTrabRacaoOperacionalReport
            ptrabData={ptrabData}
            registrosClasseI={registrosClasseI}
            onExportSuccess={handleExportSuccess}
            fileSuffix={fileSuffix} // NOVO PROP
          />
        );
      case 'operacional':
      case 'material_permanente':
      case 'hora_voo':
      case 'dor':
        return (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold">Relatório {currentReportOption.label}</h3>
            <p className="text-muted-foreground mt-2">
              Este relatório ainda não está implementado.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando dados do P Trab...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden sticky top-0 z-50 bg-background border-b border-border/50 shadow-sm">
        <div className="container max-w-7xl mx-auto py-4 px-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/ptrab')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Gerenciamento
          </Button>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Relatório:</span>
            </div>
            <Select value={selectedReport} onValueChange={(value) => setSelectedReport(value as ReportType)}>
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder="Selecione o Relatório" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className={`h-4 w-4 ${option.iconClass}`} />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto py-4 px-4">
        {renderReport()}
      </div>

      {/* O AlertDialog é mantido aqui no Manager, mas controlado pelo Reporte Logístico */}
      <AlertDialog open={showCompleteStatusDialog} onOpenChange={setShowCompleteStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar P Trab?</AlertDialogTitle>
            <AlertDialogDescription>
              O P Trab "{ptrabData?.numero_ptrab} - {ptrabData?.nome_operacao}" foi exportado. Deseja alterar o status para "Arquivado"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleConfirmCompleteStatus}>Sim, arquivar</AlertDialogAction>
            <AlertDialogCancel onClick={handleCancelCompleteStatus}>Não, manter status atual</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PTrabReportManager;