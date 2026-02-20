"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FileText, Package, Utensils, Briefcase, HardHat, Plane, ClipboardList, Frown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PTrabLogisticoReport from "@/components/reports/PTrabLogisticoReport";
import PTrabRacaoOperacionalReport from "@/components/reports/PTrabRacaoOperacionalReport";
import PTrabOperacionalReport from "@/components/reports/PTrabOperacionalReport"; 
import PTrabHorasVooReport from "@/components/reports/PTrabHorasVooReport"; 
import PTrabMaterialPermanenteReport from "@/components/reports/PTrabMaterialPermanenteReport";
import PTrabDORReport from "@/components/reports/PTrabDORReport";
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
} from "@/lib/diariaUtils"; 
import { 
  generateVerbaOperacionalMemoriaCalculo as generateVerbaOperacionalMemoriaCalculoUtility,
} from "@/lib/verbaOperacionalUtils"; 
import { 
  generateSuprimentoFundosMemoriaCalculo as generateSuprimentoFundosMemoriaCalculoUtility,
} from "@/lib/suprimentoFundosUtils"; 
import { 
  generatePassagemMemoriaCalculo as generatePassagemMemoriaCalculoUtility,
  PassagemRegistro as PassagemRegistroType, 
} from "@/lib/passagemUtils"; 
import { 
  ConcessionariaRegistroComDiretriz, 
  generateConcessionariaMemoriaCalculo as generateConcessionariaMemoriaCalculoUtility,
} from "@/lib/concessionariaUtils"; 
import { 
  MaterialConsumoRegistro as MaterialConsumoRegistroType,
  generateMaterialConsumoMemoriaCalculo as generateMaterialConsumoMemoriaCalculoUtility,
} from "@/lib/materialConsumoUtils"; 
import { 
  ComplementoAlimentacaoRegistro as ComplementoAlimentacaoRegistroType,
  generateComplementoMemoriaCalculo as generateComplementoMemoriaCalculoUtility,
} from "@/lib/complementoAlimentacaoUtils"; 
import { 
  ServicoTerceiroRegistro as ServicoTerceiroRegistroType,
  generateServicoMemoriaCalculo as generateServicoMemoriaCalculoUtility,
} from "@/lib/servicosTerceirosUtils";
import { RefLPC } from "@/types/refLPC";
import { fetchDiretrizesOperacionais, fetchDiretrizesPassagens } from "@/lib/ptrabUtils"; 
import { Tables, Json } from "@/integrations/supabase/types"; 
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";

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
  updated_at: string;
  rm_vinculacao: string;
}

export interface ClasseIRegistro extends Tables<'classe_i_registros'> {
    diasOperacao: number;
    faseAtividade: string | null;
    omQS: string;
    ugQS: string;
    nrRefInt: number;
    valorQS: number;
    valorQR: number;
    quantidadeR2: number;
    quantidadeR3: number;
    totalQS: number;
    totalQR: number;
    totalGeral: number;
    complementoQS: number;
    etapaQS: number;
    complementoQR: number;
    etapaQR: number;
    memoriaQSCustomizada: string | null;
    memoriaQRCustomizada: string | null;
    calculos: ReturnType<typeof calculateClasseICalculations>;
}

export interface DiariaRegistro extends Tables<'diaria_registros'> {
  destino: DestinoDiaria;
  quantidades_por_posto: QuantidadesPorPosto;
  valor_total: number;
  valor_nd_15: number;
  valor_nd_30: number;
  valor_taxa_embarque: number;
  is_aereo: boolean;
}

export interface VerbaOperacionalRegistro extends Tables<'verba_operacional_registros'> {
  valor_total_solicitado: number;
  valor_nd_30: number;
  valor_nd_39: number;
  dias_operacao: number;
  quantidade_equipes: number;
}

export type PassagemRegistro = PassagemRegistroType;
export type ConcessionariaRegistro = ConcessionariaRegistroComDiretriz;
export type MaterialConsumoRegistro = MaterialConsumoRegistroType; 
export type ComplementoAlimentacaoRegistro = ComplementoAlimentacaoRegistroType;
export type ServicoTerceiroRegistro = ServicoTerceiroRegistroType;

export interface MaterialPermanenteRegistro extends Tables<'material_permanente_registros'> {
  valor_total: number;
  valor_nd_52: number;
  dias_operacao: number;
  efetivo: number;
}

export interface HorasVooRegistro extends Tables<'horas_voo_registros'> {
  quantidade_hv: number;
  valor_nd_30: number;
  valor_nd_39: number;
  valor_total: number;
  dias_operacao: number;
}

export interface ItemClasseIII {
  item: string; 
  categoria: 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
  consumo_fixo: number; 
  tipo_combustivel_fixo: 'GASOLINA' | 'DIESEL'; 
  unidade_fixa: 'L/h' | 'km/L';
  quantidade: number;
  horas_dia: number;
  distancia_percorrida: number;
  quantidade_deslocamentos: number;
  dias_utilizados: number;
  consumo_lubrificante_litro: number; 
  preco_lubrificante: number; 
  memoria_customizada?: string | null; 
  preco_lubrificante_input: string; 
  consumo_lubrificante_input: string; 
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
  memoria_customizada?: string | null;
}

export interface ClasseIIRegistro extends Tables<'classe_ii_registros'> {
  animal_tipo?: 'Equino' | 'Canino' | null;
  quantidade_animais?: number;
  itens_remonta?: Json; 
  itens_saude?: Json; 
  itens_motomecanizacao?: Json;
  efetivo: number; 
}

export interface ClasseIIIRegistro extends Omit<Tables<'classe_iii_registros'>, 'itens_equipamentos'> {
  potencia_hp: number | null;
  horas_dia: number | null;
  consumo_hora: number | null;
  consumo_km_litro: number | null;
  km_dia: number | null;
  preco_litro: number;
  total_litros: number;
  valor_total: number;
  consumo_lubrificante_litro: number | null;
  preco_lubrificante: number | null;
  valor_nd_30: number;
  valor_nd_39: number;
  itens_equipamentos: ItemClasseIII[] | null;
}

export interface LinhaTabela {
  registro: ClasseIRegistro;
  valor_nd_30: number; 
  valor_nd_39: number; 
  tipo: 'QS' | 'QR';
}

export interface LinhaClasseII {
  registro: ClasseIIRegistro;
  valor_nd_30: number; 
  valor_nd_39: number; 
}

export interface LinhaClasseIII {
  registro: ClasseIIIRegistro;
  categoria_equipamento: 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO' | 'LUBRIFICANTE';
  tipo_suprimento: 'COMBUSTIVEL_GASOLINA' | 'COMBUSTIVEL_DIESEL' | 'LUBRIFICANTE';
  valor_total_linha: number;
  total_litros_linha: number;
  preco_litro_linha: number;
  memoria_calculo: string; 
}

export interface LinhaConcessionaria {
  registro: ConcessionariaRegistro;
  valor_nd_39: number;
}

interface GranularDisplayItem {
  id: string; 
  om_destino: string; 
  ug_destino: string; 
  categoria: 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
  suprimento_tipo: 'COMBUSTIVEL_GASOLINA' | 'COMBUSTIVEL_DIESEL' | 'LUBRIFICANTE';
  valor_total: number;
  total_litros: number;
  preco_litro: number; 
  dias_operacao: number;
  fase_atividade: string;
  valor_nd_30: number;
  valor_nd_39: number;
  original_registro: ClasseIIIRegistro;
  detailed_items: ItemClasseIII[];
}

export interface GrupoOMOperacional {
  diarias: DiariaRegistro[];
  verbaOperacional: VerbaOperacionalRegistro[];
  suprimentoFundos: VerbaOperacionalRegistro[];
  passagens: PassagemRegistro[];
  concessionarias: ConcessionariaRegistro[];
  materialConsumo: MaterialConsumoRegistro[]; 
  complementoAlimentacao: { registro: ComplementoAlimentacaoRegistro, subType?: 'QS' | 'QR' }[];
  servicosTerceiros: ServicoTerceiroRegistro[];
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
  linhasClasseIII: LinhaClasseIII[];
  linhasConcessionaria: LinhaConcessionaria[]; 
}

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

export const calculateItemTotalClasseIX = calculateItemTotalClasseIXUtility;

export const generateClasseIXMemoriaCalculo = (registro: ClasseIIRegistro): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    return generateClasseIXUtility(registro as any);
};

export const generateClasseIMemoriaCalculoUnificada = (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP'): string => {
    if (registro.categoria === 'RACAO_OPERACIONAL') {
        if (tipo === 'OP') {
            if (registro.memoria_calculo_op_customizada) return registro.memoria_calculo_op_customizada;
            return generateRacaoOperacionalMemoriaCalculo(registro as any);
        }
        return "N/A";
    }
    const { qs, qr } = generateRacaoQuenteMemoriaCalculo(registro as any);
    if (tipo === 'QS') return registro.memoriaQSCustomizada || qs;
    return registro.memoriaQRCustomizada || qr;
};

export const generateClasseIIMemoriaCalculo = (registro: ClasseIIRegistro, isClasseII: boolean): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) return generateClasseIXUtility(registro as any);
    if (isClasseII) return generateClasseIIUtility(registro.categoria as any, registro.itens_equipamentos as any, registro.dias_operacao, registro.om_detentora || registro.organizacao, registro.ug_detentora || registro.ug, registro.fase_atividade, registro.efetivo || 0, registro.valor_nd_30, registro.valor_nd_39);
    if (CLASSE_V_CATEGORIES.includes(registro.categoria)) return generateClasseVUtility(registro.categoria as any, registro.itens_equipamentos as any, registro.dias_operacao, registro.om_detentora || registro.organizacao, registro.ug_detentora || registro.ug, registro.fase_atividade, registro.efetivo || 0, registro.valor_nd_30, registro.valor_nd_39);
    if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) return generateClasseVIUtility(registro.categoria as any, registro.itens_equipamentos as any, registro.dias_operacao, registro.om_detentora || registro.organizacao, registro.ug_detentora || registro.ug, registro.fase_atividade, registro.efetivo || 0, registro.valor_nd_30, registro.valor_nd_39);
    if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) return generateClasseVIIUtility(registro.categoria as any, registro.itens_equipamentos as any, registro.dias_operacao, registro.om_detentora || registro.organizacao, registro.ug_detentora || registro.ug, registro.fase_atividade, registro.efetivo || 0, registro.valor_nd_30, registro.valor_nd_39);
    if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
        const itens = registro.categoria === 'Saúde' ? registro.itens_saude : registro.itens_remonta;
        return generateClasseVIIIUtility(registro.categoria as any, itens as any, registro.dias_operacao, registro.om_detentora || registro.organizacao, registro.ug_detentora || registro.ug, registro.fase_atividade, registro.efetivo || 0, registro.valor_nd_30, registro.valor_nd_39, registro.animal_tipo);
    }
    return registro.detalhamento || "Memória não disponível.";
};

export const generateDiariaMemoriaCalculoUnificada = (registro: DiariaRegistro, diretrizesOp: Tables<'diretrizes_operacionais'> | null): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    if (!diretrizesOp) return registro.detalhamento || "Diretrizes ausentes.";
    const totals = calculateDiariaTotals(registro, diretrizesOp);
    return generateDiariaMemoriaCalculoUtility(registro, diretrizesOp, totals);
};

export const generateVerbaOperacionalMemoriaCalculada = (registro: VerbaOperacionalRegistro): string => registro.detalhamento_customizado || generateVerbaOperacionalMemoriaCalculoUtility(registro as any);
export const generateSuprimentoFundosMemoriaCalculada = (registro: VerbaOperacionalRegistro): string => registro.detalhamento_customizado || generateSuprimentoFundosMemoriaCalculoUtility(registro as any);
export const generatePassagemMemoriaCalculada = (registro: PassagemRegistro): string => registro.detalhamento_customizado || generatePassagemMemoriaCalculoUtility(registro);
export const generateConcessionariaMemoriaCalculada = (registro: ConcessionariaRegistro): string => registro.detalhamento_customizado || generateConcessionariaMemoriaCalculoUtility(registro);
export const generateMaterialConsumoMemoriaCalculada = (registro: MaterialConsumoRegistro): string => registro.detalhamento_customizado || generateMaterialConsumoMemoriaCalculoUtility(registro, registro);
export const generateComplementoMemoriaCalculada = (registro: ComplementoAlimentacaoRegistro, subType?: 'QS' | 'QR'): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    const full = generateComplementoMemoriaCalculoUtility(registro, registro);
    if (registro.categoria_complemento === 'genero' && subType) {
        const parts = full.split("\n\n--- DIVISOR_MEMORIA ---\n\n");
        return subType === 'QS' ? (parts[0] || "") : (parts[1] || "");
    }
    return full;
};
export const generateServicoMemoriaCalculada = (registro: ServicoTerceiroRegistro): string => registro.detalhamento_customizado || generateServicoMemoriaCalculoUtility(registro, registro);

export const getTipoCombustivelLabel = (tipo: string) => {
    if (tipo === 'DIESEL' || tipo === 'OD' || tipo === 'COMBUSTIVEL_DIESEL') return 'DIESEL';
    if (tipo === 'GASOLINA' || tipo === 'GAS' || tipo === 'COMBUSTIVEL_GASOLINA') return 'GASOLINA';
    return tipo;
};

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

const REPORT_OPTIONS = [
  { value: 'logistico', label: 'P Trab Logístico', icon: Package, iconClass: 'text-orange-500', fileSuffix: 'Aba Log' },
  { value: 'racao_operacional', label: 'P Trab Cl I - Ração Operacional', icon: Utensils, iconClass: 'text-orange-500', fileSuffix: 'Aba Rç Op' },
  { value: 'operacional', label: 'P Trab Operacional', icon: Briefcase, iconClass: 'text-blue-500', fileSuffix: 'Aba Op' }, 
  { value: 'material_permanente', label: 'P Trab Material Permanente', icon: HardHat, iconClass: 'text-green-500', fileSuffix: 'Aba Mat Perm' },
  { value: 'hora_voo', label: 'P Trab Hora de Voo', icon: Plane, iconClass: 'text-purple-500', fileSuffix: 'Aba HV' },
  { value: 'dor', label: 'DOR', icon: ClipboardList, iconClass: 'text-gray-500', fileSuffix: 'Aba DOR' },
];

const PTrabReportManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const ptrabId = searchParams.get('ptrabId');
  
  const [ptrabData, setPtrabData] = useState<PTrabData | null>(null);
  const [registrosClasseI, setRegistrosClasseI] = useState<ClasseIRegistro[]>([]);
  const [registrosClasseII, setRegistrosClasseII] = useState<ClasseIIRegistro[]>([]);
  const [registrosClasseIII, setRegistrosClasseIII] = useState<ClasseIIIRegistro[]>([]);
  const [registrosDiaria, setRegistrosDiaria] = useState<DiariaRegistro[]>([]); 
  const [registrosVerbaOperacional, setRegistrosVerbaOperacional] = useState<VerbaOperacionalRegistro[]>([]); 
  const [registrosSuprimentoFundos, setRegistrosSuprimentoFundos] = useState<VerbaOperacionalRegistro[]>([]);
  const [registrosPassagem, setRegistrosPassagem] = useState<PassagemRegistro[]>([]);
  const [registrosConcessionaria, setRegistrosConcessionaria] = useState<ConcessionariaRegistro[]>([]);
  const [registrosMaterialConsumo, setRegistrosMaterialConsumo] = useState<MaterialConsumoRegistro[]>([]); 
  const [registrosComplementoAlimentacao, setRegistrosComplementoAlimentacao] = useState<ComplementoAlimentacaoRegistro[]>([]);
  const [registrosServicosTerceiros, setRegistrosServicosTerceiros] = useState<ServicoTerceiroRegistro[]>([]);
  const [registrosMaterialPermanente, setRegistrosMaterialPermanente] = useState<MaterialPermanenteRegistro[]>([]);
  const [registrosHorasVoo, setRegistrosHorasVoo] = useState<HorasVooRegistro[]>([]); 
  const [registrosDOR, setRegistrosDOR] = useState<any[]>([]);
  const [selectedDorId, setSelectedDorId] = useState<string | null>(null);
  const [diretrizesOperacionais, setDiretrizesOperacionais] = useState<Tables<'diretrizes_operacionais'> | null>(null);
  const [diretrizesPassagens, setDiretrizesPassagens] = useState<Tables<'diretrizes_passagens'>[]>([]);
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportType>('logistico');

  const loadData = useCallback(async () => {
    if (!ptrabId) {
      toast({ title: "Erro", description: "P Trab não selecionado", variant: "destructive" });
      navigate('/ptrab');
      return;
    }

    setLoading(true);
    try {
      const { data: ptrab, error: ptrabError } = await supabase.from('p_trab').select('*, updated_at, rm_vinculacao').eq('id', ptrabId).single();
      if (ptrabError || !ptrab) throw new Error("Não foi possível carregar o P Trab");
      const year = new Date(ptrab.periodo_inicio).getFullYear();
      
      const [cI, cII, cV, cVI, cVII, cVIIIS, cVIIIR, cIX, cIII, ref, dia, verba, pass, conc, mat, comp, serv, perm, hv, dor, dOp, dPass] = await Promise.all([
        supabase.from('classe_i_registros').select('*').eq('p_trab_id', ptrabId),
        supabase.from('classe_ii_registros').select('*').eq('p_trab_id', ptrabId),
        supabase.from('classe_v_registros').select('*').eq('p_trab_id', ptrabId),
        supabase.from('classe_vi_registros').select('*').eq('p_trab_id', ptrabId),
        supabase.from('classe_vii_registros').select('*').eq('p_trab_id', ptrabId),
        supabase.from('classe_viii_saude_registros').select('*').eq('p_trab_id', ptrabId),
        supabase.from('classe_viii_remonta_registros').select('*').eq('p_trab_id', ptrabId),
        supabase.from('classe_ix_registros').select('*').eq('p_trab_id', ptrabId),
        supabase.from('classe_iii_registros').select('*').eq('p_trab_id', ptrabId),
        supabase.from("p_trab_ref_lpc").select("*").eq("p_trab_id", ptrabId).maybeSingle(),
        supabase.from('diaria_registros').select('*').eq('p_trab_id', ptrabId), 
        supabase.from('verba_operacional_registros').select('*').eq('p_trab_id', ptrabId), 
        supabase.from('passagem_registros').select('*').eq('p_trab_id', ptrabId),
        supabase.from('concessionaria_registros').select('*').eq('p_trab_id', ptrabId),
        supabase.from('material_consumo_registros').select('*').eq('p_trab_id', ptrabId), 
        supabase.from('complemento_alimentacao_registros').select('*').eq('p_trab_id', ptrabId),
        supabase.from('servicos_terceiros_registros' as any).select('*').eq('p_trab_id', ptrabId),
        supabase.from('material_permanente_registros' as any).select('*').eq('p_trab_id', ptrabId),
        supabase.from('horas_voo_registros').select('*').eq('p_trab_id', ptrabId), 
        supabase.from('dor_registros' as any).select('*').eq('p_trab_id', ptrabId).order('created_at', { ascending: true }),
        fetchDiretrizesOperacionais(year),
        fetchDiretrizesPassagens(year),
      ]);
      
      setDiretrizesOperacionais(dOp as any);
      setDiretrizesPassagens(dPass as any); 

      const allClasseItems = [
        ...(cII.data || []).map(r => ({ ...r, efetivo: r.efetivo || 0 })),
        ...(cV.data || []).map(r => ({ ...r, efetivo: r.efetivo || 0 })),
        ...(cVI.data || []).map(r => ({ ...r, efetivo: r.efetivo || 0 })), 
        ...(cVII.data || []).map(r => ({ ...r, efetivo: r.efetivo || 0 })), 
        ...(cVIIIS.data || []).map(r => ({ ...r, itens_equipamentos: r.itens_saude, categoria: 'Saúde', efetivo: r.efetivo || 0 })), 
        ...(cVIIIR.data || []).map(r => ({ ...r, itens_equipamentos: r.itens_remonta, categoria: 'Remonta/Veterinária', efetivo: r.efetivo || 0 })), 
        ...(cIX.data || []).map(r => ({ ...r, itens_equipamentos: r.itens_motomecanizacao, efetivo: r.efetivo || 0 })), 
      ];

      setPtrabData(ptrab as any);
      setRegistrosClasseI((cI.data || []).map(r => ({ ...r, diasOperacao: r.dias_operacao, faseAtividade: r.fase_atividade, omQS: r.om_qs, ugQS: r.ug_qs, nrRefInt: r.nr_ref_int, valorQS: Number(r.valor_qs), valorQR: Number(r.valor_qr), quantidadeR2: r.quantidade_r2 || 0, quantidadeR3: r.quantidade_r3 || 0, totalQS: Number(r.total_qs), totalQR: Number(r.total_qr), totalGeral: Number(r.total_geral), complementoQS: Number(r.complemento_qs), etapaQS: Number(r.etapa_qs), complementoQR: Number(r.complemento_qr), etapaQR: Number(r.etapa_qr), memoriaQSCustomizada: r.memoria_calculo_qs_customizada, memoriaQRCustomizada: r.memoria_calculo_qr_customizada, calculos: calculateClasseICalculations(r.efetivo, r.dias_operacao, r.nr_ref_int || 0, Number(r.valor_qs), Number(r.valor_qr)) })) as any);
      setRegistrosClasseII(allClasseItems as any);
      setRegistrosClasseIII((cIII.data || []).map(r => ({ ...r, itens_equipamentos: r.itens_equipamentos as any })) as any);
      setRefLPC(ref.data as any);
      setRegistrosDiaria((dia.data || []).map(r => ({ ...r, valor_total: Number(r.valor_total || 0) })) as any);
      setRegistrosVerbaOperacional((verba.data || []).filter(r => r.detalhamento !== 'Suprimento de Fundos').map(r => ({ ...r, valor_total_solicitado: Number(r.valor_total_solicitado || 0) })) as any);
      setRegistrosSuprimentoFundos((verba.data || []).filter(r => r.detalhamento === 'Suprimento de Fundos').map(r => ({ ...r, valor_total_solicitado: Number(r.valor_total_solicitado || 0) })) as any);
      setRegistrosPassagem((pass.data || []).map(r => ({ ...r, valor_total: Number(r.valor_total || 0) })) as any);
      setRegistrosConcessionaria((conc.data || []).map(r => ({ ...r, valor_total: Number(r.valor_total || 0) })) as any);
      setRegistrosMaterialConsumo((mat.data || []).map(r => ({ ...r, valor_total: Number(r.valor_total || 0) })) as any);
      setRegistrosComplementoAlimentacao((comp.data || []).map(r => ({ ...r, valor_total: Number(r.valor_total || 0) })) as any);
      setRegistrosServicosTerceiros((serv.data || []).map(r => ({ ...r, valor_total: Number(r.valor_total || 0) })) as any);
      setRegistrosMaterialPermanente((perm.data || []).map(r => ({ ...r, valor_total: Number(r.valor_total || 0) })) as any);
      setRegistrosHorasVoo((hv.data || []).map(r => ({ ...r, valor_total: Number(r.valor_total || 0) })) as any);
      setRegistrosDOR(dor.data || []);
      if (dor.data && dor.data.length > 0) setSelectedDorId(dor.data[0].id);
    } catch (error) {
      console.error(error);
      toast({ title: "Erro", description: "Falha ao carregar dados.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [ptrabId, navigate, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const normalizarNome = (v?: string) => (v || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const getOMPriority = (om: string, rm: string): 1 | 2 | 3 => {
    const nOM = normalizarNome(om); const nRM = normalizarNome(rm);
    if (nOM === nRM || /^\d+ª?\s*RM$/.test(nOM) || nOM.includes('REGIAO MILITAR') || nRM.includes(nOM) || nOM.includes('RM')) return 1;
    if (nOM.includes('BDA') || nOM.includes('BRIGADA')) return 2;
    return 3;
  };
  const isRegiaoMilitar = (om: string, rm: string) => {
    const nOM = normalizarNome(om); const nRM = normalizarNome(rm);
    return nOM === nRM || /^\d+ª?\s*RM$/.test(nOM) || nOM.includes('REGIAO MILITAR') || nRM.includes(nOM);
  };

  const reportContext = useMemo(() => {
    if (!ptrabData) return null;
    const grupos: Record<string, GrupoOM> = {};
    const init = (n: string) => { if (!grupos[n]) grupos[n] = { linhasQS: [], linhasQR: [], linhasClasseII: [], linhasClasseV: [], linhasClasseVI: [], linhasClasseVII: [], linhasClasseVIII: [], linhasClasseIX: [], linhasClasseIII: [], linhasConcessionaria: [] }; };
    registrosClasseI.filter(r => r.categoria === 'RACAO_QUENTE').forEach(r => { init(r.omQS || r.organizacao); grupos[r.omQS || r.organizacao].linhasQS.push({ registro: r, tipo: 'QS', valor_nd_30: r.totalQS, valor_nd_39: 0 }); init(r.organizacao); grupos[r.organizacao].linhasQR.push({ registro: r, tipo: 'QR', valor_nd_30: r.totalQR, valor_nd_39: 0 }); });
    registrosClasseII.forEach(r => { init(r.organizacao); const l = { registro: r, valor_nd_30: r.valor_nd_30, valor_nd_39: r.valor_nd_39 }; if (CLASSE_V_CATEGORIES.includes(r.categoria)) grupos[r.organizacao].linhasClasseV.push(l); else if (CLASSE_VI_CATEGORIES.includes(r.categoria)) grupos[r.organizacao].linhasClasseVI.push(l); else if (CLASSE_VII_CATEGORIES.includes(r.categoria)) grupos[r.organizacao].linhasClasseVII.push(l); else if (CLASSE_VIII_CATEGORIES.includes(r.categoria)) grupos[r.organizacao].linhasClasseVIII.push(l); else if (CLASSE_IX_CATEGORIES.includes(r.categoria)) grupos[r.organizacao].linhasClasseIX.push(l); else grupos[r.organizacao].linhasClasseII.push(l); });
    
    const gruposOp: Record<string, GrupoOMOperacional> = {};
    const initOp = (n: string) => { if (!gruposOp[n]) gruposOp[n] = { diarias: [], verbaOperacional: [], suprimentoFundos: [], passagens: [], concessionarias: [], materialConsumo: [], complementoAlimentacao: [], servicosTerceiros: [] }; };
    registrosDiaria.forEach(r => { initOp(r.organizacao); gruposOp[r.organizacao].diarias.push(r); });
    registrosVerbaOperacional.forEach(r => { initOp(r.om_detentora || r.organizacao); gruposOp[r.om_detentora || r.organizacao].verbaOperacional.push(r); });
    registrosSuprimentoFundos.forEach(r => { initOp(r.organizacao); gruposOp[r.organizacao].suprimentoFundos.push(r); });
    registrosPassagem.forEach(r => { initOp(r.om_detentora || r.organizacao); gruposOp[r.om_detentora || r.organizacao].passagens.push(r); });
    registrosConcessionaria.forEach(r => { initOp(r.om_detentora || r.organizacao); gruposOp[r.om_detentora || r.organizacao].concessionarias.push(r); });
    registrosMaterialConsumo.forEach(r => { initOp(r.om_detentora || r.organizacao); gruposOp[r.om_detentora || r.organizacao].materialConsumo.push(r); });
    registrosComplementoAlimentacao.forEach(r => { if (r.categoria_complemento === 'genero') { initOp(r.organizacao); gruposOp[r.organizacao].complementoAlimentacao.push({ registro: r, subType: 'QR' }); initOp(r.om_qs || r.organizacao); gruposOp[r.om_qs || r.organizacao].complementoAlimentacao.push({ registro: r, subType: 'QS' }); } else { initOp(r.om_detentora || r.organizacao); gruposOp[r.om_detentora || r.organizacao].complementoAlimentacao.push({ registro: r }); } });
    registrosServicosTerceiros.forEach(r => { initOp(r.om_detentora || r.organizacao); gruposOp[r.om_detentora || r.organizacao].servicosTerceiros.push(r); });

    const rm = ptrabData.rm_vinculacao;
    const omsOrd = Object.keys(grupos).sort((a, b) => { const aP = getOMPriority(a, rm); const bP = getOMPriority(b, rm); return aP !== bP ? aP - bP : a.localeCompare(b); });
    const omsOpOrd = Object.keys(gruposOp).sort((a, b) => { const aP = getOMPriority(a, rm); const bP = getOMPriority(b, rm); return aP !== bP ? aP - bP : a.localeCompare(b); });

    return { grupos, gruposOp, omsOrd, omsOpOrd };
  }, [ptrabData, registrosClasseI, registrosClasseII, registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, registrosConcessionaria, registrosMaterialConsumo, registrosComplementoAlimentacao, registrosServicosTerceiros]);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="ml-2 text-muted-foreground">Carregando...</span></div>;
  if (!ptrabData || !reportContext) return null;

  const renderReport = () => {
    const { grupos, gruposOp, omsOrd, omsOpOrd } = reportContext;
    const fileSuffix = currentReportOption.fileSuffix;

    switch (selectedReport) {
      case 'logistico':
        return <PTrabLogisticoReport ptrabData={ptrabData} registrosClasseI={registrosClasseI} registrosClasseII={registrosClasseII} registrosClasseIII={registrosClasseIII} nomeRM={ptrabData.rm_vinculacao} omsOrdenadas={omsOrd} gruposPorOM={grupos} calcularTotaisPorOM={() => ({})} fileSuffix={fileSuffix} generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculoUnificada} generateClasseIIMemoriaCalculo={generateClasseIIMemoriaCalculo} generateClasseVMemoriaCalculo={(r) => generateClasseIIMemoriaCalculo(r as any, false)} generateClasseVIMemoriaCalculo={(r) => generateClasseIIMemoriaCalculo(r as any, false)} generateClasseVIIMemoriaCalculo={(r) => generateClasseIIMemoriaCalculo(r as any, false)} generateClasseVIIIMemoriaCalculo={(r) => generateClasseIIMemoriaCalculo(r as any, false)} />;
      case 'racao_operacional':
        return <PTrabRacaoOperacionalReport ptrabData={ptrabData} registrosClasseI={registrosClasseI} fileSuffix={fileSuffix} generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculoUnificada} />;
      case 'operacional':
        return <PTrabOperacionalReport ptrabData={ptrabData} omsOrdenadas={omsOpOrd} gruposPorOM={gruposOp} registrosDiaria={registrosDiaria} registrosVerbaOperacional={registrosVerbaOperacional} registrosSuprimentoFundos={registrosSuprimentoFundos} registrosPassagem={registrosPassagem} registrosConcessionaria={registrosConcessionaria} registrosMaterialConsumo={registrosMaterialConsumo} registrosComplementoAlimentacao={registrosComplementoAlimentacao} registrosServicosTerceiros={registrosServicosTerceiros} diretrizesOperacionais={diretrizesOperacionais} diretrizesPassagens={diretrizesPassagens} fileSuffix={fileSuffix} generateDiariaMemoriaCalculo={generateDiariaMemoriaCalculoUnificada} generateVerbaOperacionalMemoriaCalculo={generateVerbaOperacionalMemoriaCalculada} generateSuprimentoFundosMemoriaCalculo={generateSuprimentoFundosMemoriaCalculada} generatePassagemMemoriaCalculo={generatePassagemMemoriaCalculada} generateConcessionariaMemoriaCalculo={generateConcessionariaMemoriaCalculada} generateMaterialConsumoMemoriaCalculo={generateMaterialConsumoMemoriaCalculada} generateComplementoMemoriaCalculo={generateComplementoMemoriaCalculada} generateServicoMemoriaCalculo={generateServicoMemoriaCalculada} />;
      case 'material_permanente':
        return <PTrabMaterialPermanenteReport ptrabData={ptrabData} registrosMaterialPermanente={registrosMaterialPermanente} fileSuffix={fileSuffix} />;
      case 'hora_voo':
        return <PTrabHorasVooReport ptrabData={ptrabData} omsOrdenadas={[]} gruposPorOM={{}} fileSuffix={fileSuffix} />;
      case 'dor':
        const selectedDor = registrosDOR.find(d => d.id === selectedDorId) || registrosDOR[0];
        return <PTrabDORReport ptrabData={ptrabData} dorData={selectedDor} selector={registrosDOR.length > 1 ? <Select value={selectedDorId || ''} onValueChange={setSelectedDorId}><SelectTrigger className="w-[300px] bg-white"><SelectValue placeholder="Escolha o DOR" /></SelectTrigger><SelectContent>{registrosDOR.map((d: any) => <SelectItem key={d.id} value={d.id}>DOR Nr {d.numero_dor || 'S/N'} - {new Date(d.created_at).toLocaleDateString()}</SelectItem>)}</SelectContent></Select> : null} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden sticky top-0 z-50 bg-background border-b border-border/50 shadow-sm">
        <div className="container max-w-7xl mx-auto py-4 px-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/ptrab')}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
          <div className="flex items-center gap-4">
            <Select value={selectedReport} onValueChange={(v) => setSelectedReport(v as any)}>
              <SelectTrigger className="w-[320px]"><SelectValue placeholder="Relatório" /></SelectTrigger>
              <SelectContent>{REPORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}><div className="flex items-center gap-2"><o.icon className={`h-4 w-4 ${o.iconClass}`} />{o.label}</div></SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="container max-w-7xl mx-auto py-4 px-4">{renderReport()}</div>
    </div>
  );
};

export default PTrabReportManager;