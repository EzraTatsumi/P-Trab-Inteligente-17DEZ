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
import PTrabOperacionalReport from "@/components/reports/PTrabOperacionalReport"; // NOVO: Importar o relatório operacional
import { 
  generateRacaoQuenteMemoriaCalculo, 
  generateRacaoOperacionalMemoriaCalculo,
  calculateClasseICalculations,
} from "@/lib/classeIUtils";
import { generateClasseIIMemoriaCalculo as generateClasseIIUtility } from "@/lib/classeIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVUtility } from "@/lib/classeVUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIUtility } from "@/lib/classeVIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIIUtility } from "@/lib/classeVIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIIIUtility } from "@/lib/classeVIIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseIXUtility, calculateItemTotalClasseIX as calculateItemTotalClasseIXUtility } from "@/lib/classeIXUtils";
import { generateGranularMemoriaCalculo as generateClasseIIIGranularUtility, calculateItemTotals } from "@/lib/classeIIIUtils";
import { 
  generateDiariaMemoriaCalculo as generateDiariaMemoriaCalculoUtility, 
  calculateDiariaTotals,
  DestinoDiaria,
  QuantidadesPorPosto,
} from "@/lib/diariaUtils"; // NOVO: Importar utilitários de Diária
import { 
  generateVerbaOperacionalMemoriaCalculo as generateVerbaOperacionalMemoriaCalculoUtility,
} from "@/lib/verbaOperacionalUtils"; // NOVO: Importar utilitários de Verba Operacional
import { 
  generateSuprimentoFundosMemoriaCalculo as generateSuprimentoFundosMemoriaCalculoUtility,
} from "@/lib/suprimentoFundosUtils"; // NOVO: Importar utilitários de Suprimento de Fundos
import { 
  generatePassagemMemoriaCalculo,
} from "@/lib/passagemUtils"; // Importando utilitários de Passagem
import { RefLPC } from "@/types/refLPC";
import { fetchDiretrizesOperacionais } from "@/lib/ptrabUtils";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { Tables } from "@/integrations/supabase/types"; // Importar Tables
import { 
    PTrabData, 
    ClasseIRegistro, 
    ClasseIIRegistro, 
    ClasseIIIRegistro, 
    DiariaRegistro, 
    VerbaOperacionalRegistro, 
    PassagemRegistro,
    LinhaTabela,
    LinhaClasseII,
    LinhaClasseIII,
    GrupoOM,
    ItemClasseIII,
    ItemClasseIX,
    ItemClasseII, // Adicionado ItemClasseII
    ItemSaude, // Adicionado ItemSaude
    ItemRemonta, // Adicionado ItemRemonta
} from "@/types/ptrab"; // NOVO: Importar todos os tipos do arquivo central

// =================================================================
// TIPOS E FUNÇÕES AUXILIARES (Exportados para uso nos relatórios)
// =================================================================

// CORREÇÃO: Exportar todos os tipos necessários
export { PTrabData, DiariaRegistro, VerbaOperacionalRegistro, PassagemRegistro, ClasseIRegistro, ClasseIIIRegistro, LinhaClasseIII, LinhaTabela, LinhaClasseII, GrupoOM, ItemClasseII, ItemClasseIII, ItemClasseIX, ItemSaude, ItemRemonta };

export const CLASSE_V_CATEGORIES = ["Armt L", "Armt P", "IODCT", "DQBRN"];
export const CLASSE_VI_CATEGORIES = ["Gerador", "Embarcação", "Equipamento de Engenharia"];
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

// Helper function to get the label for Classe II/V/VI/VII/VIII/IX categories
export const getClasseIILabel = (category: string): string => {
    switch (category) {
        case 'Vtr Administrativa': return 'Viatura Administrativa';
        case 'Vtr Operacional': return 'Viatura Operacional';
        case 'Motocicleta': return 'Motocicleta';
        case 'Vtr Blindada': return 'Viatura Blindada';
        case 'Equipamento Individual': return 'Eqp Individual';
        case 'Proteção Balística': return 'Prot Balística';
        case 'Material de Estacionamento': return 'Mat Estacionamento';
        case 'Armt L': return 'Armamento Leve';
        case 'Armt P': return 'Armamento Pesado';
        case 'IODCT': return 'IODCT';
        case 'DQBRN': return 'DQBRN';
        case 'Gerador': return 'Gerador';
        case 'Embarcação': return 'Embarcação';
        case 'Equipamento de Engenharia': return 'Eqp Engenharia';
        case 'Comunicações': return 'Comunicações';
        case 'Informática': return 'Informática';
        case 'Saúde': return 'Saúde';
        case 'Remonta/Veterinária': return 'Remonta/Veterinária';
        default: return category;
    }
};

// Exportando a função de cálculo de item da utilidade
export const calculateItemTotalClasseIX = calculateItemTotalClasseIXUtility;

// Função para gerar a memória de cálculo da Classe IX (agora usando o utilitário)
export const generateClasseIXMemoriaCalculo = (registro: ClasseIIRegistro): string => {
    if (registro.detalhamento_customizado) {
      return registro.detalhamento_customizado;
    }
    
    // Usa o utilitário importado
    return generateClasseIXUtility(registro as any);
};

/**
 * Função unificada para gerar a memória de cálculo da Classe I, priorizando o customizado.
 */
export const generateClasseIMemoriaCalculoUnificada = (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP'): string => {
    if (registro.categoria === 'RACAO_OPERACIONAL') {
        if (tipo === 'OP') {
            if (registro.memoriaOPCustomizada && registro.memoriaOPCustomizada.trim().length > 0) {
                return registro.memoriaOPCustomizada;
            }
            
            return generateRacaoOperacionalMemoriaCalculo({
                id: registro.id,
                organizacao: registro.organizacao,
                ug: registro.ug,
                diasOperacao: registro.diasOperacao,
                faseAtividade: registro.faseAtividade,
                efetivo: registro.efetivo,
                quantidadeR2: registro.quantidadeR2,
                quantidadeR3: registro.quantidadeR3,
                omQS: null, ugQS: null, nrRefInt: null, valorQS: null, valorQR: null,
                calculos: {
                    totalQS: 0, totalQR: 0, nrCiclos: 0, diasEtapaPaga: 0, diasEtapaSolicitada: 0, totalEtapas: 0,
                    complementoQS: 0, etapaQS: 0, complementoQR: 0, etapaQR: 0,
                },
                categoria: 'RACAO_OPERACIONAL',
            });
        }
        return "Memória não aplicável para Ração Operacional.";
    }

    // Lógica para Ração Quente (QS/QR)
    if (tipo === 'QS') {
        if (registro.memoriaQSCustomizada && registro.memoriaQSCustomizada.trim().length > 0) {
            return registro.memoriaQSCustomizada;
        }
        const { qs } = generateRacaoQuenteMemoriaCalculo({
            id: registro.id,
            organizacao: registro.organizacao,
            ug: registro.ug,
            diasOperacao: registro.diasOperacao,
            faseAtividade: registro.faseAtividade,
            omQS: registro.omQS,
            ugQS: registro.ugQS,
            efetivo: registro.efetivo,
            nrRefInt: registro.nrRefInt,
            valorQS: registro.valorQS,
            valorQR: registro.valorQR,
            calculos: {
                totalQS: registro.totalQS,
                totalQR: registro.totalQR,
                nrCiclos: calculateClasseICalculations(registro.efetivo, registro.diasOperacao, registro.nrRefInt || 0, registro.valorQS || 0, registro.valorQR || 0).nrCiclos,
                diasEtapaPaga: 0,
                diasEtapaSolicitada: calculateClasseICalculations(registro.efetivo, registro.diasOperacao, registro.nrRefInt || 0, registro.valorQS || 0, registro.valorQR || 0).diasEtapaSolicitada,
                totalEtapas: 0,
                complementoQS: registro.complementoQS,
                etapaQS: registro.etapaQS,
                complementoQR: registro.complementoQR,
                etapaQR: registro.etapaQR,
            },
            quantidadeR2: 0,
            quantidadeR3: 0,
            categoria: 'RACAO_QUENTE',
        });
        return qs;
    }

    if (tipo === 'QR') {
        if (registro.memoriaQRCustomizada && registro.memoriaQRCustomizada.trim().length > 0) {
            return registro.memoriaQRCustomizada;
        }
        const { qr } = generateRacaoQuenteMemoriaCalculo({
            id: registro.id,
            organizacao: registro.organizacao,
            ug: registro.ug,
            diasOperacao: registro.diasOperacao,
            faseAtividade: registro.faseAtividade,
            omQS: registro.omQS,
            ugQS: registro.ugQS,
            efetivo: registro.efetivo,
            nrRefInt: registro.nrRefInt,
            valorQS: registro.valorQS,
            valorQR: registro.valorQR,
            calculos: {
                totalQS: registro.totalQS,
                totalQR: registro.totalQR,
                nrCiclos: calculateClasseICalculations(registro.efetivo, registro.diasOperacao, registro.nrRefInt || 0, registro.valorQS || 0, registro.valorQR || 0).nrCiclos,
                diasEtapaPaga: 0,
                diasEtapaSolicitada: calculateClasseICalculations(registro.efetivo, registro.diasOperacao, registro.nrRefInt || 0, registro.valorQS || 0, registro.valorQR || 0).diasEtapaSolicitada,
                totalEtapas: 0,
                complementoQS: registro.complementoQS,
                etapaQS: registro.etapaQS,
                complementoQR: registro.complementoQR,
                etapaQR: registro.etapaQR,
            },
            quantidadeR2: 0,
            quantidadeR3: 0,
            categoria: 'RACAO_QUENTE',
        });
        return qr;
    }
    
    return "Memória de cálculo não encontrada.";
};

/**
 * Função unificada para gerar a memória de cálculo da Classe II, V, VI, VII, VIII e IX,
 * priorizando o customizado e usando os utilitários corretos.
 */
export const generateClasseIIMemoriaCalculo = (registro: ClasseIIRegistro, isClasseII: boolean): string => {
    if (!registro || !registro.categoria) {
        return "Registro inválido ou categoria ausente.";
    }
    
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
      return registro.detalhamento_customizado;
    }
    
    if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
        return generateClasseIXUtility(registro as any);
    }
    
    if (isClasseII) {
        return generateClasseIIUtility(
            registro.categoria,
            registro.itensEquipamentos as ItemClasseII[], // CORREÇÃO: Cast para ItemClasseII[]
            registro.diasOperacao,
            registro.omDetentora || registro.organizacao,
            registro.ugDetentora || registro.ug,
            registro.faseAtividade,
            registro.efetivo || 0,
            registro.valorND30,
            registro.valorND39
        );
    }
    
    if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
        return generateClasseVUtility(
            registro.categoria,
            registro.itensEquipamentos as ItemClasseII[], // CORREÇÃO: Cast para ItemClasseII[]
            registro.diasOperacao,
            registro.omDetentora || registro.organizacao,
            registro.ugDetentora || registro.ug,
            registro.faseAtividade,
            registro.efetivo || 0,
            registro.valorND30,
            registro.valorND39
        );
    }
    
    if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
        return generateClasseVIUtility(
            registro.categoria,
            registro.itensEquipamentos as ItemClasseII[], // CORREÇÃO: Cast para ItemClasseII[]
            registro.diasOperacao,
            registro.omDetentora || registro.organizacao,
            registro.ugDetentora || registro.ug,
            registro.faseAtividade,
            registro.efetivo || 0,
            registro.valorND30,
            registro.valorND39
        );
    }
    
    if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
        return generateClasseVIIUtility(
            registro.categoria,
            registro.itensEquipamentos as ItemClasseII[], // CORREÇÃO: Cast para ItemClasseII[]
            registro.diasOperacao,
            registro.omDetentora || registro.organizacao,
            registro.ugDetentora || registro.ug,
            registro.faseAtividade,
            registro.efetivo || 0,
            registro.valorND30,
            registro.valorND39
        );
    }
    
    if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
        // CORREÇÃO: Usar os campos corretos para Classe VIII
        const itens = registro.categoria === 'Saúde' ? (registro as any).itensSaude : (registro as any).itensRemonta;
        
        return generateClasseVIIIUtility(
            registro.categoria as 'Saúde' | 'Remonta/Veterinária',
            itens,
            registro.diasOperacao,
            registro.omDetentora || registro.organizacao,
            registro.ugDetentora || registro.ug,
            registro.faseAtividade,
            registro.efetivo || 0,
            registro.valorND30,
            registro.valorND39,
            (registro as any).animalTipo
        );
    }
    
    return registro.detalhamento || "Memória de cálculo não disponível.";
};

/**
 * Função unificada para gerar a memória de cálculo da Diária, priorizando o customizado.
 */
export const generateDiariaMemoriaCalculoUnificada = (
    registro: DiariaRegistro, 
    diretrizesOp: Tables<'diretrizes_operacionais'> | null
): string => {
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
        return registro.detalhamento_customizado;
    }
    
    if (!diretrizesOp) {
        return registro.detalhamento || "Diretrizes Operacionais ausentes. Memória de cálculo não gerada.";
    }

    // Recalcula os totais para garantir que a memória automática esteja atualizada com as diretrizes atuais
    const totals = calculateDiariaTotals(registro, diretrizesOp);
    
    return generateDiariaMemoriaCalculoUtility(registro, diretrizesOp, totals);
};

/**
 * Função unificada para gerar a memória de cálculo da Verba Operacional, priorizando o customizado.
 */
export const generateVerbaOperacionalMemoriaCalculada = (
    registro: VerbaOperacionalRegistro
): string => {
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
        return registro.detalhamento_customizado;
    }
    
    // O cálculo da Verba Operacional é simples e não depende de diretrizes externas, apenas dos dados do registro.
    return generateVerbaOperacionalMemoriaCalculoUtility(registro as any);
};

/**
 * Função unificada para gerar a memória de cálculo do Suprimento de Fundos, priorizando o customizado.
 */
export const generateSuprimentoFundosMemoriaCalculada = (
    registro: VerbaOperacionalRegistro
): string => {
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
        return registro.detalhamento_customizado;
    }
    
    // Usa o utilitário específico para Suprimento de Fundos
    return generateSuprimentoFundosMemoriaCalculoUtility(registro as any);
};

/**
 * Função unificada para gerar a memória de cálculo da Passagem, priorizando o customizado.
 */
export const generatePassagemMemoriaCalculada = (
    registro: PassagemRegistro
): string => {
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
        return registro.detalhamento_customizado;
    }
    
    // Usa o utilitário importado
    return generatePassagemMemoriaCalculo(registro);
};


// =================================================================
// FUNÇÕES AUXILIARES DE RÓTULO
// =================================================================

export const getTipoCombustivelLabel = (tipo: string) => {
    if (tipo === 'DIESEL' || tipo === 'OD' || tipo === 'COMBUSTIVEL_DIESEL') {
        return 'DIESEL';
    } else if (tipo === 'GASOLINA' || tipo === 'GAS' || tipo === 'COMBUSTIVEL_GASOLINA') {
        return 'GASOLINA';
    }
    return tipo;
};

// =================================================================
// FUNÇÕES DE NORMALIZAÇÃO E IDENTIFICAÇÃO DA RM (AÇÕES 1 e 2)
// =================================================================

const normalizarNome = (valor?: string) =>
  (valor || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const isRegiaoMilitar = (nomeOM: string, nomeRM: string) => {
  const om = normalizarNome(nomeOM);
  const rm = normalizarNome(nomeRM);

  if (om === rm) return true;

  if (/^\d+ª?\s*RM$/.test(om) || om.includes('REGIAO MILITAR')) return true;

  if (rm.includes(om)) return true;

  const numRM = rm.match(/\d+/)?.[0];
  if (numRM && om.startsWith(numRM)) {
      if (om.includes('RM')) return true;
  }

  return false;
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
    fileSuffix: string;
}

const REPORT_OPTIONS: ReportOption[] = [
  { value: 'logistico', label: 'P Trab Logístico', icon: Package, iconClass: 'text-orange-500', fileSuffix: 'Aba Log' },
  { value: 'racao_operacional', label: 'P Trab Cl I - Ração Operacional', icon: Utensils, iconClass: 'text-orange-500', fileSuffix: 'Aba Rç Op' },
  { value: 'operacional', label: 'P Trab Operacional', icon: Briefcase, iconClass: 'text-blue-500', fileSuffix: 'Aba Op' }, // NOVO
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
  const [registrosDiaria, setRegistrosDiaria] = useState<DiariaRegistro[]>([]); // NOVO: Estado para Diárias
  const [registrosVerbaOperacional, setRegistrosVerbaOperacional] = useState<VerbaOperacionalRegistro[]>([]); 
  const [registrosSuprimentoFundos, setRegistrosSuprimentoFundos] = useState<VerbaOperacionalRegistro[]>([]); // NOVO ESTADO
  const [registrosPassagem, setRegistrosPassagem] = useState<PassagemRegistro[]>([]); // NOVO ESTADO
  const [diretrizesOperacionais, setDiretrizesOperacionais] = useState<Tables<'diretrizes_operacionais'> | null>(null); // NOVO: Estado para Diretrizes Operacionais
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportType>('logistico');

  const isLubrificante = (r: ClasseIIIRegistro) => r.tipoEquipamento === 'LUBRIFICANTE_CONSOLIDADO';
  const isCombustivel = (r: ClasseIIIRegistro) => r.tipoEquipamento === 'COMBUSTIVEL_CONSOLIDADO';
  
  const currentReportOption = useMemo(() => REPORT_OPTIONS.find(r => r.value === selectedReport)!, [selectedReport]);

  const loadData = useCallback(async () => {
    if (!ptrabId) {
      toast({ title: "Erro", description: "P Trab não selecionado", variant: "destructive" });
      navigate('/ptrab');
      return;
    }

    setLoading(true);
    
    try {
      // 1. Fetch PTrab Data
      const { data: ptrab, error: ptrabError } = await supabase
        .from('p_trab')
        .select('*, updated_at, rm_vinculacao')
        .eq('id', ptrabId)
        .single();

      if (ptrabError || !ptrab) throw new Error("Não foi possível carregar o P Trab");

      // 2. Fetch Registros de Classes (usando snake_case do DB)
      const { data: classeIData } = await supabase
        .from('classe_i_registros')
        .select('*, memoria_calculo_qs_customizada, memoria_calculo_qr_customizada, memoria_calculo_op_customizada, fase_atividade, categoria, quantidade_r2, quantidade_r3')
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
        { data: refLPCData },
        { data: diariaData }, 
        { data: verbaOperacionalData }, 
        { data: passagemData }, 
      ] = await Promise.all([
        supabase.from('classe_ii_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora, efetivo').eq('p_trab_id', ptrabId),
        supabase.from('classe_v_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora, efetivo').eq('p_trab_id', ptrabId),
        supabase.from('classe_vi_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora').eq('p_trab_id', ptrabId),
        supabase.from('classe_vii_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora, efetivo').eq('p_trab_id', ptrabId),
        supabase.from('classe_viii_saude_registros').select('*, itens_saude, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora').eq('p_trab_id', ptrabId),
        supabase.from('classe_viii_remonta_registros').select('*, itens_remonta, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, animal_tipo, quantidade_animais, om_detentora, ug_detentora').eq('p_trab_id', ptrabId),
        supabase.from('classe_ix_registros').select('*, itens_motomecanizacao, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora, efetivo').eq('p_trab_id', ptrabId),
        supabase.from('classe_iii_registros').select('*, detalhamento_customizado, itens_equipamentos, fase_atividade, consumo_lubrificante_litro, preco_lubrificante, valor_nd_30, valor_nd_39, om_detentora, ug_detentora, potencia_hp, consumo_hora, consumo_km_litro, horas_dia, km_dia, tipo_equipamento_detalhe, total_litros_sem_margem, efetivo').eq('p_trab_id', ptrabId),
        supabase.from("p_trab_ref_lpc").select("*").eq("p_trab_id", ptrabId).maybeSingle(),
        supabase.from('diaria_registros').select('*').eq('p_trab_id', ptrabId), 
        supabase.from('verba_operacional_registros').select('*, objeto_aquisicao, objeto_contratacao, proposito, finalidade, local, tarefa').eq('p_trab_id', ptrabId), 
        supabase.from('passagem_registros').select('*').eq('p_trab_id', ptrabId),
      ]);
      
      // 3. Fetch Diretrizes Operacionais
      const diretrizesOpData = await fetchDiretrizesOperacionais(new Date(ptrab.periodo_inicio).getFullYear());
      setDiretrizesOperacionais(diretrizesOpData as Tables<'diretrizes_operacionais'> || null);

      // 4. Mapeamento e Normalização (snake_case -> camelCase)
      
      // Classe I
      setRegistrosClasseI((classeIData || []).map(r => ({
          id: r.id,
          organizacao: r.organizacao,
          ug: r.ug,
          diasOperacao: r.dias_operacao, // Mapeado
          faseAtividade: r.fase_atividade, // Mapeado
          omQS: r.om_qs, // Mapeado
          ugQS: r.ug_qs, // Mapeado
          efetivo: r.efetivo,
          nrRefInt: r.nr_ref_int, // Mapeado
          valorQS: Number(r.valor_qs), // Mapeado
          valorQR: Number(r.valor_qr), // Mapeado
          complementoQS: Number(r.complemento_qs), // Mapeado
          etapaQS: Number(r.etapa_qs), // Mapeado
          totalQS: Number(r.total_qs), // Mapeado
          complementoQR: Number(r.complemento_qr), // Mapeado
          etapaQR: Number(r.etapa_qr), // Mapeado
          totalQR: Number(r.total_qr), 
          totalGeral: Number(r.total_geral), // Mapeado
          memoriaQSCustomizada: r.memoria_calculo_qs_customizada, // Mapeado
          memoriaQRCustomizada: r.memoria_calculo_qr_customizada, // Mapeado
          memoriaOPCustomizada: r.memoria_calculo_op_customizada, // Mapeado
          categoria: (r.categoria || 'RACAO_QUENTE') as 'RACAO_QUENTE' | 'RACAO_OPERACIONAL',
          quantidadeR2: r.quantidade_r2 || 0, // Mapeado
          quantidadeR3: r.quantidade_r3 || 0, // Mapeado
          calculos: calculateClasseICalculations(r.efetivo, r.dias_operacao, r.nr_ref_int || 0, Number(r.valor_qs), Number(r.valor_qr)),
      })) as ClasseIRegistro[]);
      
      // Classes II, V, VI, VII, VIII, IX (Unificação e Mapeamento)
      const allClasseItems = [
        ...(classeIIData || []).map(r => ({ ...r, itens_equipamentos: r.itens_equipamentos, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo })),
        ...(classeVData || []).map(r => ({ ...r, itens_equipamentos: r.itens_equipamentos, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo })),
        ...(classeVIData || []).map(r => ({ ...r, itens_equipamentos: r.itens_equipamentos, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: 0 })), // Classe VI não tem efetivo no DB
        ...(classeVIIData || []).map(r => ({ ...r, itens_equipamentos: r.itens_equipamentos, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo })),
        ...(classeVIIISaudeData || []).map(r => ({ ...r, itens_equipamentos: r.itens_saude, categoria: 'Saúde', om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: 0 })),
        ...(classeVIIIRemontaData || []).map(r => ({ ...r, itens_equipamentos: r.itens_remonta, categoria: 'Remonta/Veterinária', animal_tipo: r.animal_tipo, quantidade_animais: r.quantidade_animais, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: 0 })),
        ...(classeIXData || []).map(r => ({ ...r, itens_equipamentos: r.itens_motomecanizacao, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo })),
      ];

      setRegistrosClasseII(allClasseItems.map(r => ({
          id: r.id,
          organizacao: r.organizacao,
          ug: r.ug,
          diasOperacao: r.dias_operacao, // Mapeado
          faseAtividade: r.fase_atividade, // Mapeado
          categoria: r.categoria,
          itensEquipamentos: (r.itens_equipamentos || []) as ItemClasseII[], // Mapeado e Cast
          valorTotal: Number(r.valor_total || 0), // Mapeado
          detalhamento: r.detalhamento,
          detalhamento_customizado: r.detalhamento_customizado,
          valorND30: Number(r.valor_nd_30 || 0), // Mapeado
          valorND39: Number(r.valor_nd_39 || 0), // Mapeado
          omDetentora: r.om_detentora, // Mapeado
          ugDetentora: r.ug_detentora, // Mapeado
          efetivo: r.efetivo || 0,
          // Campos específicos de Classe VIII (se existirem)
          animalTipo: (r as any).animal_tipo || null,
          quantidadeAnimais: (r as any).quantidade_animais || 0,
          itensSaude: (r as any).itens_saude || null,
          itensRemonta: (r as any).itens_remonta || null,
      })) as ClasseIIRegistro[]);
      
      // Classe III
      setRegistrosClasseIII((classeIIIData || []).map(r => ({
          id: r.id,
          organizacao: r.organizacao,
          ug: r.ug,
          diasOperacao: r.dias_operacao, // Mapeado
          faseAtividade: r.fase_atividade, // Mapeado
          tipoEquipamento: r.tipo_equipamento, // Mapeado
          quantidade: r.quantidade,
          precoLitro: Number(r.preco_litro || 0), // Mapeado
          tipoCombustivel: r.tipo_combustivel, // Mapeado
          totalLitros: Number(r.total_litros || 0), // Mapeado
          valorTotal: Number(r.valor_total || 0), // Mapeado
          detalhamento: r.detalhamento,
          detalhamento_customizado: r.detalhamento_customizado,
          consumoLubrificanteLitro: Number(r.consumo_lubrificante_litro || 0), // Mapeado
          precoLubrificante: Number(r.preco_lubrificante || 0), // Mapeado
          valorND30: Number(r.valor_nd_30 || 0), // Mapeado
          valorND39: Number(r.valor_nd_39 || 0), // Mapeado
          omDetentora: r.om_detentora, // Mapeado
          ugDetentora: r.ug_detentora, // Mapeado
          itensEquipamentos: (r.itens_equipamentos || []) as ItemClasseIII[] | null, // Mapeado e Cast
          // Campos opcionais
          categoria: r.categoria,
          consumoHora: r.consumo_hora,
          consumoKmLitro: r.consumo_km_litro,
          horasDia: r.horas_dia,
          kmDia: r.km_dia,
          tipoEquipamentoDetalhe: r.tipo_equipamento_detalhe,
          totalLitrosSemMargem: r.total_litros_sem_margem,
          potenciaHp: r.potencia_hp,
          efetivo: r.efetivo,
      })) as ClasseIIIRegistry[]);
      
      setRefLPC(refLPCData as RefLPC || null);
      
      // Diárias
      setRegistrosDiaria((diariaData || []).map(r => ({
          id: r.id,
          organizacao: r.organizacao,
          ug: r.ug,
          diasOperacao: r.dias_operacao, // Mapeado
          faseAtividade: r.fase_atividade, // Mapeado
          postoGraduacao: r.posto_graduacao, // Mapeado
          destino: r.destino as DestinoDiaria,
          quantidade: r.quantidade,
          valorDiariaUnitario: r.valor_diaria_unitario, // Mapeado
          valorTaxaEmbarque: Number(r.valor_taxa_embarque || 0), // Mapeado
          valorTotal: Number(r.valor_total || 0), // Mapeado
          valorND15: Number(r.valor_nd_15 || 0), // Mapeado
          valorND30: Number(r.valor_nd_30 || 0), // Mapeado
          detalhamento: r.detalhamento,
          detalhamento_customizado: r.detalhamento_customizado,
          nrViagens: r.nr_viagens || 1, // Mapeado
          localAtividade: r.local_atividade, // Mapeado
          quantidadesPorPosto: r.quantidades_por_posto as QuantidadesPorPosto, // Mapeado e Cast
          isAereo: r.is_aereo || false, // Mapeado
          omDetentora: r.om_detentora, // Mapeado
          ugDetentora: r.ug_detentora, // Mapeado
      })) as DiariaRegistro[]);
      
      // Verba Operacional e Suprimento de Fundos
      const allVerbaRecords = (verbaOperacionalData || []).map(r => ({
          id: r.id,
          organizacao: r.organizacao,
          ug: r.ug,
          omDetentora: r.om_detentora, // Mapeado
          ugDetentora: r.ug_detentora, // Mapeado
          diasOperacao: r.dias_operacao || 1, // Mapeado
          quantidadeEquipes: r.quantidade_equipes || 1, // Mapeado
          valorTotalSolicitado: Number(r.valor_total_solicitado || 0), // Mapeado
          faseAtividade: r.fase_atividade, // Mapeado
          detalhamento: r.detalhamento,
          detalhamento_customizado: r.detalhamento_customizado,
          valorND30: Number(r.valor_nd_30 || 0), // Mapeado
          valorND39: Number(r.valor_nd_39 || 0), // Mapeado
          objetoAquisicao: r.objeto_aquisicao, // Mapeado
          objetoContratacao: r.objeto_contratacao, // Mapeado
          proposito: r.proposito,
          finalidade: r.finalidade,
          local: r.local,
          tarefa: r.tarefa,
      })) as VerbaOperacionalRegistro[];
      
      setRegistrosVerbaOperacional(allVerbaRecords.filter(r => r.detalhamento !== 'Suprimento de Fundos'));
      setRegistrosSuprimentoFundos(allVerbaRecords.filter(r => r.detalhamento === 'Suprimento de Fundos'));
      
      // Passagens
      setRegistrosPassagem((passagemData || []).map(r => ({
          id: r.id,
          organizacao: r.organizacao,
          ug: r.ug,
          omDetentora: r.om_detentora, // Mapeado
          ugDetentora: r.ug_detentora, // Mapeado
          diasOperacao: r.dias_operacao || 0, // Mapeado
          faseAtividade: r.fase_atividade, // Mapeado
          trechoId: r.trecho_id, // Mapeado
          diretrizId: r.diretriz_id, // Mapeado
          origem: r.origem,
          destino: r.destino,
          tipoTransporte: r.tipo_transporte, // Mapeado
          isIdaVolta: r.is_ida_volta || false, // Mapeado
          valorUnitario: Number(r.valor_unitario || 0), // Mapeado
          quantidadePassagens: r.quantidade_passagens || 0, // Mapeado
          valorTotal: Number(r.valor_total || 0), // Mapeado
          valorND33: Number(r.valor_nd_33 || 0), // Mapeado
          detalhamento: r.detalhamento,
          detalhamento_customizado: r.detalhamento_customizado,
          efetivo: r.efetivo || 0,
      })) as PassagemRegistro[]);
      
      setPtrabData(ptrab as PTrabData);
      
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

  // --- LÓGICA DE AGRUPAMENTO E CÁLCULO (Mantida no Manager para ser passada aos relatórios) ---
  const gruposPorOM = useMemo(() => {
    const grupos: Record<string, GrupoOM> = {};
    const initializeGroup = (name: string) => {
        if (!grupos[name]) {
            grupos[name] = { 
                linhasQS: [], linhasQR: [], linhasClasseII: [], linhasClasseV: [],
                linhasClasseVI: [], linhasClasseVII: [], linhasClasseVIII: [], linhasClasseIX: [],
                linhasClasseIII: []
            };
        }
    };

    // 1. Processar Classe I (Apenas Ração Quente para a tabela principal)
    registrosClasseI.filter(r => r.categoria === 'RACAO_QUENTE').forEach((registro) => {
        // Usa omQS para a OM fornecedora (se existir), senão usa a OM de destino
        const omFornecedora = registro.omQS || registro.organizacao;
        initializeGroup(omFornecedora);
        grupos[omFornecedora].linhasQS.push({ 
            registro, 
            tipo: 'QS',
            valor_nd_30: registro.totalQS,
            valor_nd_39: 0,
        });
        
        // A linha QR usa a OM de destino (organizacao)
        initializeGroup(registro.organizacao);
        grupos[registro.organizacao].linhasQR.push({ 
            registro, 
            tipo: 'QR',
            valor_nd_30: registro.totalQR,
            valor_nd_39: 0,
        });
    });
    
    // 2. Processar Classes II, V, VI, VII, VIII, IX
    registrosClasseII.forEach((registro) => {
        // Usa omDetentora (OM de destino do recurso) se existir, senão usa a OM de destino
        const omDestinoRecurso = registro.omDetentora || registro.organizacao;
        initializeGroup(omDestinoRecurso);
        const omGroup = grupos[omDestinoRecurso];
        
        const linha: LinhaClasseII = { 
            registro,
            valor_nd_30: registro.valorND30,
            valor_nd_39: registro.valorND39,
        };
        
        if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseV.push(linha);
        } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseVI.push(linha);
        } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseVII.push(linha);
        } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseVIII.push(linha);
        } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseIX.push(linha);
        } else {
            omGroup.linhasClasseII.push(linha);
        }
    });

    // 3. Processar Classe III (Combustível e Lubrificante) - DESAGREGAÇÃO
    registrosClasseIII.forEach((registro) => {
        const isCombustivel = registro.tipoEquipamento === 'COMBUSTIVEL_CONSOLIDADO';
        const isLubrificante = registro.tipoEquipamento === 'LUBRIFICANTE_CONSOLIDADO';
        
        if (isCombustivel || isLubrificante) {
            
            let omDestinoRecurso: string;
            if (isCombustivel) {
                // Para Combustível, o recurso vai para a OM Fornecedora (omDetentora) se for diferente da OM que usa (organizacao)
                omDestinoRecurso = registro.omDetentora || registro.organizacao;
            } else {
                // Para Lubrificante, o recurso vai para a OM que usa (organizacao)
                omDestinoRecurso = registro.organizacao;
            }
            
            initializeGroup(omDestinoRecurso);
            
            const itens = registro.itensEquipamentos || [];
            
            // Agrupa os itens granulares por Categoria (GERADOR, EMBARCACAO, etc.)
            const gruposGranulares: Record<string, ItemClasseIII[]> = {};
            
            itens.forEach(item => {
                const key = item.categoria;
                if (!gruposGranulares[key]) gruposGranulares[key] = [];
                gruposGranulares[key].push(item);
            });
            
            Object.entries(gruposGranulares).forEach(([categoriaKey, itensGrupo]) => {
                if (itensGrupo.length === 0) return;
                
                const primeiroItem = itensGrupo[0];
                
                let totalLitrosLinha = 0;
                let valorTotalLinha = 0;
                let precoLitroLinha = 0;
                
                itensGrupo.forEach(item => {
                    const totals = calculateItemTotals(item, refLPC, registro.diasOperacao);
                    if (isCombustivel) {
                        totalLitrosLinha += totals.totalLitros;
                        valorTotalLinha += totals.valorCombustivel;
                        precoLitroLinha = totals.precoLitro; // Deve ser o mesmo para todos os itens do mesmo tipo de combustível/OM
                        
                    } else if (isLubrificante) {
                        totalLitrosLinha += totals.litrosLubrificante;
                        valorTotalLinha += totals.valorLubrificante;
                        precoLitroLinha = totalLitrosLinha > 0 ? valorTotalLinha / totalLitrosLinha : 0;
                    }
                });
                
                if (valorTotalLinha === 0 && totalLitrosLinha === 0) return;

                const tipoSuprimento: LinhaClasseIII['tipo_suprimento'] = isCombustivel 
                    ? (primeiroItem.tipo_combustivel_fixo === 'GASOLINA' ? 'COMBUSTIVEL_GASOLINA' : 'COMBUSTIVEL_DIESEL')
                    : 'LUBRIFICANTE';
                
                let memoriaCalculo = "";
                
                const omFornecedora = registro.omDetentora || '';
                const ugFornecedora = registro.ugDetentora || '';
                
                const omDestinoLubrificante = registro.organizacao; // Lubrificante é consumido na OM que usa
                const ugDestinoLubrificante = registro.ug;
                
                const granularItem: any = { // Usando 'any' temporariamente para evitar erro de tipagem complexa
                    id: `${registro.id}-${categoriaKey}-${tipoSuprimento}`,
                    om_destino: registro.organizacao,
                    ug_destino: registro.ug,
                    categoria: categoriaKey as any,
                    suprimento_tipo: tipoSuprimento,
                    valor_total: valorTotalLinha,
                    total_litros: totalLitrosLinha,
                    preco_litro: precoLitroLinha,
                    dias_operacao: registro.diasOperacao,
                    fase_atividade: registro.faseAtividade || '',
                    valor_nd_30: isCombustivel ? valorTotalLinha : (isLubrificante ? valorTotalLinha : 0),
                    valor_nd_39: 0,
                    original_registro: registro,
                    detailed_items: itensGrupo, // Passa apenas os itens deste grupo granular
                };
                
                const itemComMemoria = itensGrupo.find(i => !!i.memoria_customizada) || itensGrupo[0];
                if (itemComMemoria && itemComMemoria.memoria_customizada && itemComMemoria.memoria_customizada.trim().length > 0) {
                    memoriaCalculo = itemComMemoria.memoria_customizada;
                } else {
                    memoriaCalculo = generateClasseIIIGranularUtility(
                        granularItem, 
                        refLPC, 
                        isCombustivel ? omFornecedora : omDestinoLubrificante, 
                        isCombustivel ? ugFornecedora : ugDestinoLubrificante
                    );
                }
                
                grupos[omDestinoRecurso].linhasClasseIII.push({
                    registro,
                    categoria_equipamento: categoriaKey as any,
                    tipo_suprimento: tipoSuprimento,
                    valor_total_linha: valorTotalLinha,
                    total_litros_linha: totalLitrosLinha,
                    preco_litro_linha: precoLitroLinha,
                    memoria_calculo: memoriaCalculo,
                });
            });
        }
    });
    
    return grupos;
  }, [registrosClasseI, registrosClasseII, registrosClasseIII, refLPC]);
  
  const nomeRM = useMemo(() => {
    return ptrabData?.rm_vinculacao || '';
  }, [ptrabData]);

  const omsOrdenadas = useMemo(() => {
    const oms = Object.keys(gruposPorOM);
    const rmName = nomeRM;
    
    return oms.sort((a, b) => {
        const aIsRM = isRegiaoMilitar(a, rmName);
        const bIsRM = isRegiaoMilitar(b, rmName);
        
        if (aIsRM && !bIsRM) return -1;
        if (!aIsRM && bIsRM) return 1;
        
        return a.localeCompare(b);
    });
  }, [gruposPorOM, nomeRM]);
  
  const calcularTotaisClasseIII = (linhas: LinhaClasseIII[]) => {
    let dieselLitros = 0;
    let gasolinaLitros = 0;
    let valorDiesel = 0;
    let valorGasolina = 0;
    let valorTotalCombustivel = 0;

    linhas.forEach(linha => {
      if (!linha) return;

      if (linha.tipo_suprimento === 'COMBUSTIVEL_DIESEL') {
        dieselLitros += Number(linha.total_litros_linha || 0);
        valorDiesel += Number(linha.valor_total_linha || 0);
      }

      if (linha.tipo_suprimento === 'COMBUSTIVEL_GASOLINA') {
        gasolinaLitros += Number(linha.total_litros_linha || 0);
        valorGasolina += Number(linha.valor_total_linha || 0);
      }
    });
    
    valorTotalCombustivel = valorDiesel + valorGasolina;

    return {
      dieselLitros,
      gasolinaLitros,
      valorDiesel,
      valorGasolina,
      valorTotalCombustivel
    };
  };

  const calcularTotaisPorOM = useCallback((grupo: GrupoOM, nomeOM: string) => {
    
    const totalQS = grupo.linhasQS.reduce((acc, linha) => acc + linha.registro.totalQS, 0);
    const totalQR = grupo.linhasQR.reduce((acc, linha) => acc + linha.registro.totalQR, 0);
    
    const totalClasseII_ND30 = grupo.linhasClasseII.reduce((acc, linha) => acc + linha.registro.valorND30, 0);
    const totalClasseII_ND39 = grupo.linhasClasseII.reduce((acc, linha) => acc + linha.registro.valorND39, 0);
    
    const totalClasseV_ND30 = grupo.linhasClasseV.reduce((acc, linha) => acc + linha.registro.valorND30, 0);
    const totalClasseV_ND39 = grupo.linhasClasseV.reduce((acc, linha) => acc + linha.registro.valorND39, 0);
    
    const totalClasseVI_ND30 = grupo.linhasClasseVI.reduce((acc, linha) => acc + linha.registro.valorND30, 0);
    const totalClasseVI_ND39 = grupo.linhasClasseVI.reduce((acc, linha) => acc + linha.registro.valorND39, 0);
    
    const totalClasseVII_ND30 = grupo.linhasClasseVII.reduce((acc, linha) => acc + linha.registro.valorND30, 0);
    const totalClasseVII_ND39 = grupo.linhasClasseVII.reduce((acc, linha) => acc + linha.registro.valorND39, 0);
    
    const totalClasseVIII_ND30 = grupo.linhasClasseVIII.reduce((acc, linha) => acc + linha.registro.valorND30, 0);
    const totalClasseVIII_ND39 = grupo.linhasClasseVIII.reduce((acc, linha) => acc + linha.registro.valorND39, 0);
    
    const totalClasseIX_ND30 = grupo.linhasClasseIX.reduce((acc, linha) => acc + linha.registro.valorND30, 0);
    const totalClasseIX_ND39 = grupo.linhasClasseIX.reduce((acc, linha) => acc + linha.registro.valorND39, 0);
    
    const totalLubrificante = grupo.linhasClasseIII
        .filter(l => l.tipo_suprimento === 'LUBRIFICANTE')
        .reduce((acc, linha) => acc + linha.valor_total_linha, 0);
    
    const total_33_90_30 = totalQS + totalQR + 
                           totalClasseII_ND30 + totalClasseV_ND30 + totalClasseVI_ND30 + totalClasseVII_ND30 + totalClasseVIII_ND30 + totalClasseIX_ND30 +
                           totalLubrificante; 
    
    const total_33_90_39 = totalClasseII_ND39 + totalClasseV_ND39 + totalClasseVI_ND39 + totalClasseVII_ND39 + totalClasseVIII_ND39 + totalClasseIX_ND39;
    
    const total_parte_azul = total_33_90_30 + total_33_90_39;
    
    const isRMFornecedora = isRegiaoMilitar(nomeOM, nomeRM);
    
    const { dieselLitros, gasolinaLitros, valorTotalCombustivel, valorDiesel, valorGasolina } = isRMFornecedora
        ? calcularTotaisClasseIII(grupo.linhasClasseIII)
        : { dieselLitros: 0, gasolinaLitros: 0, valorTotalCombustivel: 0, valorDiesel: 0, valorGasolina: 0 };
        
    const total_gnd3 = total_parte_azul + valorTotalCombustivel; 
    
    return {
      total_33_90_30,
      total_33_90_39,
      total_parte_azul,
      total_combustivel: valorTotalCombustivel,
      total_gnd3,
      totalDieselLitros: dieselLitros,
      totalGasolinaLitros: gasolinaLitros,
      valorDiesel: valorDiesel,
      valorGasolina: valorGasolina,
    };
  }, [nomeRM]);

  const renderReport = () => {
    if (!ptrabData) return null;

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
            fileSuffix={fileSuffix}
            generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculoUnificada}
            generateClasseIIMemoriaCalculo={generateClasseIIMemoriaCalculo}
            generateClasseVMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
            generateClasseVIMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
            generateClasseVIIMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
            generateClasseVIIIMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
            generateClasseIXMemoriaCalculo={generateClasseIXMemoriaCalculo}
          />
        );
      case 'racao_operacional':
        return (
          <PTrabRacaoOperacionalReport
            ptrabData={ptrabData}
            registrosClasseI={registrosClasseI}
            fileSuffix={fileSuffix}
            generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculoUnificada}
          />
        );
      case 'operacional':
        return (
            <PTrabOperacionalReport
                ptrabData={ptrabData}
                registrosDiaria={registrosDiaria}
                registrosVerbaOperacional={registrosVerbaOperacional} 
                registrosSuprimentoFundos={registrosSuprimentoFundos} 
                registrosPassagem={registrosPassagem} // ADDED
                diretrizesOperacionais={diretrizesOperacionais}
                fileSuffix={fileSuffix}
                generateDiariaMemoriaCalculo={generateDiariaMemoriaCalculoUnificada}
                generateVerbaOperacionalMemoriaCalculo={generateVerbaOperacionalMemoriaCalculada}
                generateSuprimentoFundosMemoriaCalculo={generateSuprimentoFundosMemoriaCalculada}
                generatePassagemMemoriaCalculo={generatePassagemMemoriaCalculada} // ADDED
            />
        );
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
    </div>
  );
};

export default PTrabReportManager;