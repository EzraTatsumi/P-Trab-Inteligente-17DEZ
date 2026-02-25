import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FileText, Package, Utensils, Briefcase, HardHat, Plane, ClipboardList, Frown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PTrabLogisticoReport from "@/components/reports/PTrabLogisticoReport";
import PTrabRacaoOperacionalReport from "@/components/reports/PTrabRacaoOperacionalReport";
import PTrabOperacionalReport from "@/components/reports/PTrabOperacionalReport"; 
import PTrabHorasVooReport from "@/components/reports/PTrabHorasVooReport"; 
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
  generatePassagemMemoriaCalculo,
  PassagemRegistro as PassagemRegistroType, 
} from "@/lib/passagemUtils"; 
import { 
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
import { GHOST_DATA, isGhostMode } from "@/lib/ghostStore";
import { runMission06 } from "@/tours/missionTours";
import PageMetadata from "@/components/PageMetadata";
import { useSession } from "@/components/SessionContextProvider";

// =================================================================
// TIPOS E FUNÇÕES AUXILIARES
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
    calculos: any;
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

export interface ConcessionariaRegistro extends Tables<'concessionaria_registros'> {
  totalND39?: number;
  diretriz?: Tables<'diretrizes_concessionaria'>;
}

export type MaterialConsumoRegistro = MaterialConsumoRegistroType; 

export type ComplementoAlimentacaoRegistro = ComplementoAlimentacaoRegistroType;

export type ServicoTerceiroRegistro = ServicoTerceiroRegistroType;

export type MaterialPermanenteRegistro = Tables<'material_permanente_registros'>;

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

export interface GrupoOMOperacional {
  diarias: DiariaRegistro[];
  verbaOperacional: VerbaOperacionalRegistro[];
  suprimentoFundos: VerbaOperacionalRegistro[];
  passagens: PassagemRegistro[];
  concessionarias: ConcessionariaRegistro[];
  materialConsumo: MaterialConsumoRegistro[]; 
  complementoAlimentacao: { registro: ComplementoAlimentacaoRegistro, subType?: 'QS' | 'QR' }[];
  servicosTerceiros: ServicoTerceiroRegistro[];
  materialPermanente: MaterialPermanenteRegistro[];
  horasVoo: HorasVooRegistro[];
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

const getOMPriority = (nomeOM: string, nomeRM: string): 1 | 2 | 3 => {
  const om = (nomeOM || '').toUpperCase();
  const rm = (nomeRM || '').toUpperCase();
  if (om === rm || om.includes('RM')) return 1;
  if (om.includes('BDA') || om.includes('BRIGADA')) return 2;
  return 3;
};

const isRegiaoMilitar = (nomeOM: string, nomeRM: string) => {
  const om = (nomeOM || '').toUpperCase();
  const rm = (nomeRM || '').toUpperCase();
  return om === rm || om.includes('REGIAO MILITAR') || om.includes('RM');
};

export const generateClasseIMemoriaCalculoUnificada = (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP'): string => {
    if (registro.categoria === 'RACAO_OPERACIONAL') {
        if (tipo === 'OP') {
            if (registro.memoria_calculo_op_customizada) return registro.memoria_calculo_op_customizada;
            return generateRacaoOperacionalMemoriaCalculo({ ...registro, diasOperacao: registro.diasOperacao, efetivo: registro.efetivo, quantidadeR2: registro.quantidadeR2, quantidadeR3: registro.quantidadeR3 } as any);
        }
        return "N/A";
    }
    if (tipo === 'QS' && registro.memoriaQSCustomizada) return registro.memoriaQSCustomizada;
    if (tipo === 'QR' && registro.memoriaQRCustomizada) return registro.memoriaQRCustomizada;
    
    const calcs = calculateClasseICalculations(registro.efetivo, registro.diasOperacao, registro.nrRefInt, registro.valorQS, registro.valorQR);
    const { qs, qr } = generateRacaoQuenteMemoriaCalculo({ ...registro, calculos: calcs } as any);
    return tipo === 'QS' ? qs : qr;
};

export const generateClasseIIMemoriaCalculo = (registro: ClasseIIRegistro, isClasseII: boolean): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    return generateClasseIIUtility(registro.categoria as any, registro.itens_equipamentos as any, registro.dias_operacao, registro.om_detentora || registro.organizacao, registro.ug_detentora || registro.ug, registro.fase_atividade, registro.efetivo || 0, registro.valor_nd_30, registro.valor_nd_39);
};

export const generateDiariaMemoriaCalculoUnificada = (registro: DiariaRegistro, diretrizesOp: Tables<'diretrizes_operacionais'> | null): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    if (!diretrizesOp) return "";
    const totals = calculateDiariaTotals(registro, diretrizesOp);
    return generateDiariaMemoriaCalculoUtility(registro, diretrizesOp, totals);
};

export const generateVerbaOperacionalMemoriaCalculada = (registro: VerbaOperacionalRegistro): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    return generateVerbaOperacionalMemoriaCalculoUtility(registro as any);
};

export const generateSuprimentoFundosMemoriaCalculada = (registro: VerbaOperacionalRegistro): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    return generateSuprimentoFundosMemoriaCalculoUtility(registro as any);
};

export const generatePassagemMemoriaCalculada = (registro: PassagemRegistro): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    return generatePassagemMemoriaCalculo(registro);
};

export const generateConcessionariaMemoriaCalculada = (registro: ConcessionariaRegistro): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    return generateConcessionariaMemoriaCalculoUtility(registro as any);
};

export const generateMaterialConsumoMemoriaCalculada = (registro: MaterialConsumoRegistro): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    return generateMaterialConsumoMemoriaCalculoUtility(registro as any, { organizacao: registro.organizacao, efetivo: registro.efetivo, dias_operacao: registro.dias_operacao, fase_atividade: registro.fase_atividade });
};

export const generateComplementoMemoriaCalculada = (registro: ComplementoAlimentacaoRegistro, subType?: 'QS' | 'QR'): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    const full = generateComplementoMemoriaCalculoUtility(registro as any, { organizacao: registro.organizacao, efetivo: registro.efetivo, dias_operacao: registro.dias_operacao, fase_atividade: registro.fase_atividade });
    if (registro.categoria_complemento === 'genero' && subType) {
        const parts = full.split("\n\n--- DIVISOR_MEMORIA ---\n\n");
        return subType === 'QS' ? (parts[0] || "") : (parts[1] || "");
    }
    return full;
};

export const generateServicoMemoriaCalculada = (registro: ServicoTerceiroRegistro): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    return generateServicoMemoriaCalculoUtility(registro as any, { organizacao: registro.organizacao, efetivo: registro.efetivo, dias_operacao: registro.dias_operacao, fase_atividade: registro.fase_atividade });
};

type ReportType = 'logistico' | 'racao_operacional' | 'operacional' | 'material_permanente' | 'hora_voo' | 'dor';

const REPORT_OPTIONS = [
  { value: 'logistico', label: 'P Trab Logístico', icon: Package, iconClass: 'text-orange-500', fileSuffix: 'Aba Log' },
  { value: 'racao_operacional', label: 'P Trab Cl I - Ração Operacional', icon: Utensils, iconClass: 'text-orange-500', fileSuffix: 'Aba Rç Op' },
  { value: 'operacional', label: 'P Trab Operacional', icon: Briefcase, iconClass: 'text-blue-500', fileSuffix: 'Aba Op' }, 
  { value: 'material_permanente', label: 'P Trab Material Permanente', icon: HardHat, iconClass: 'text-green-500', fileSuffix: 'Aba Mat Perm' },
  { value: 'hora_voo', label: 'P Trab Hora de Voo', icon: Plane, iconClass: 'text-purple-500', fileSuffix: 'Aba HV' },
  { value: 'dor', label: 'DOR', icon: ClipboardList, iconClass: 'text-gray-500', fileSuffix: 'Aba DOR' },
] as const;

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

const PTrabReportManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useSession();
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
  const [registrosHorasVoo, setRegistrosHorasVoo] = useState<HorasVooRegistro[]>([]); 
  const [diretrizesOperacionais, setDiretrizesOperacionais] = useState<Tables<'diretrizes_operacionais'> | null>(null);
  const [diretrizesPassagens, setDiretrizesPassagens] = useState<Tables<'diretrizes_passagens'>[]>([]);
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportType>('logistico');

  const currentReportOption = useMemo(() => REPORT_OPTIONS.find(r => r.value === selectedReport)!, [selectedReport]);

  const loadData = useCallback(async () => {
    if (!ptrabId && !isGhostMode()) {
        navigate('/ptrab');
        return;
    }

    setLoading(true);
    
    try {
      if (isGhostMode()) {
          setPtrabData(GHOST_DATA.p_trab_exemplo);
          setLoading(false);
          return;
      }

      const { data: ptrab, error: ptrabError } = await supabase
        .from('p_trab')
        .select('*, updated_at, rm_vinculacao')
        .eq('id', ptrabId!)
        .single();

      if (ptrabError || !ptrab) throw new Error("Falha ao carregar P Trab");

      const year = new Date(ptrab.periodo_inicio).getFullYear();
      
      const [
        { data: clI }, { data: clII }, { data: clV }, { data: clVI }, { data: clVII },
        { data: clVIIIS }, { data: clVIIIR }, { data: clIX }, { data: clIII },
        { data: lpc }, { data: diar }, { data: verb }, { data: pass }, { data: conc },
        { data: matC }, { data: comp }, { data: serv }, { data: hv },
        diretrizesOp, diretrizesPass
      ] = await Promise.all([
        supabase.from('classe_i_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from('classe_ii_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from('classe_v_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from('classe_vi_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from('classe_vii_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from('classe_viii_saude_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from('classe_viii_remonta_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from('classe_ix_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from('classe_iii_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from("p_trab_ref_lpc").select("*").eq("p_trab_id", ptrabId!).maybeSingle(),
        supabase.from('diaria_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from('verba_operacional_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from('passagem_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from('concessionaria_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from('material_consumo_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from('complemento_alimentacao_registros').select('*').eq('p_trab_id', ptrabId!),
        supabase.from('servicos_terceiros_registros' as any).select('*').eq('p_trab_id', ptrabId!),
        supabase.from('horas_voo_registros').select('*').eq('p_trab_id', ptrabId!),
        fetchDiretrizesOperacionais(year),
        fetchDiretrizesPassagens(year)
      ]);

      setPtrabData(ptrab as any);
      setRegistrosClasseI((clI || []).map(r => ({ ...r, totalQS: Number(r.total_qs), totalQR: Number(r.total_qr), totalGeral: Number(r.total_geral), diasOperacao: r.dias_operacao, faseAtividade: r.fase_atividade, omQS: r.om_qs, ugQS: r.ug_qs, nrRefInt: r.nr_ref_int, valorQS: Number(r.valor_qs), valorQR: Number(r.valor_qr), quantidadeR2: r.quantidade_r2, quantidadeR3: r.quantidade_r3, memoriaQSCustomizada: r.memoria_calculo_qs_customizada, memoriaQRCustomizada: r.memoria_calculo_qr_customizada }) as any));
      setRegistrosClasseII([...(clII||[]), ...(clV||[]), ...(clVI||[]), ...(clVII||[]), ...(clVIIIS||[]).map(x=>({...x, categoria: 'Saúde'})), ...(clVIIIR||[]).map(x=>({...x, categoria: 'Remonta/Veterinária'})), ...(clIX||[])] as any);
      setRegistrosClasseIII((clIII || []) as any);
      setRefLPC(lpc as any);
      setRegistrosDiaria((diar || []).map(r => ({ ...r, valor_total: Number(r.valor_total) })) as any);
      setRegistrosVerbaOperacional((verb || []).filter(v => v.detalhamento !== 'Suprimento de Fundos') as any);
      setRegistrosSuprimentoFundos((verb || []).filter(v => v.detalhamento === 'Suprimento de Fundos') as any);
      setRegistrosPassagem((pass || []) as any);
      setRegistrosConcessionaria((conc || []) as any);
      setRegistrosMaterialConsumo((matC || []) as any);
      setRegistrosComplementoAlimentacao((comp || []) as any);
      setRegistrosServicosTerceiros((serv || []) as any);
      setRegistrosHorasVoo((hv || []) as any);
      setDiretrizesOperacionais(diretrizesOp as any);
      setDiretrizesPassagens(diretrizesPass as any);

    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar dados do relatório");
    } finally {
      setLoading(false);
    }
  }, [ptrabId, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const startTour = searchParams.get('startTour') === 'true';
    if (startTour && isGhostMode() && user?.id) {
      setTimeout(() => {
        runMission06(user.id, () => {
            navigate('/ptrab?showHub=true');
        });
      }, 500);
    }
  }, [searchParams, user?.id]);

  const nomeRM = ptrabData?.rm_vinculacao || "";

  const gruposPorOM = useMemo(() => {
    const map: Record<string, GrupoOM> = {};
    const init = (om: string) => { if(!map[om]) map[om] = { linhasQS: [], linhasQR: [], linhasClasseII: [], linhasClasseV: [], linhasClasseVI: [], linhasClasseVII: [], linhasClasseVIII: [], linhasClasseIX: [], linhasClasseIII: [], linhasConcessionaria: [] }; };

    registrosClasseI.filter(r => r.categoria === 'RACAO_QUENTE').forEach(r => {
        init(r.omQS || r.organizacao); map[r.omQS || r.organizacao].linhasQS.push({ registro: r, tipo: 'QS', valor_nd_30: r.totalQS, valor_nd_39: 0 });
        init(r.organizacao); map[r.organizacao].linhasQR.push({ registro: r, tipo: 'QR', valor_nd_30: r.totalQR, valor_nd_39: 0 });
    });
    registrosClasseII.forEach(r => {
        init(r.organizacao);
        const l = { registro: r, valor_nd_30: r.valor_nd_30, valor_nd_39: r.valor_nd_39 };
        if (CLASSE_V_CATEGORIES.includes(r.categoria)) map[r.organizacao].linhasClasseV.push(l);
        else if (CLASSE_VI_CATEGORIES.includes(r.categoria)) map[r.organizacao].linhasClasseVI.push(l);
        else if (CLASSE_VII_CATEGORIES.includes(r.categoria)) map[r.organizacao].linhasClasseVII.push(l);
        else if (CLASSE_VIII_CATEGORIES.includes(r.categoria)) map[r.organizacao].linhasClasseVIII.push(l);
        else if (CLASSE_IX_CATEGORIES.includes(r.categoria)) map[r.organizacao].linhasClasseIX.push(l);
        else map[r.organizacao].linhasClasseII.push(l);
    });
    return map;
  }, [registrosClasseI, registrosClasseII]);

  const omsOrdenadas = useMemo(() => Object.keys(gruposPorOM).sort((a,b) => getOMPriority(a, nomeRM) - getOMPriority(b, nomeRM) || a.localeCompare(b)), [gruposPorOM, nomeRM]);

  const gruposOperacionaisPorOM = useMemo(() => {
    const map: Record<string, GrupoOMOperacional> = {};
    const init = (om: string) => { if(!map[om]) map[om] = { diarias: [], verbaOperacional: [], suprimentoFundos: [], passagens: [], concessionarias: [], materialConsumo: [], complementoAlimentacao: [], servicosTerceiros: [], materialPermanente: [], horasVoo: [] }; };
    registrosDiaria.forEach(r => { init(r.organizacao); map[r.organizacao].diarias.push(r); });
    registrosVerbaOperacional.forEach(r => { const om = r.om_detentora || r.organizacao; init(om); map[om].verbaOperacional.push(r); });
    registrosPassagem.forEach(r => { const om = r.om_detentora || r.organizacao; init(om); map[om].passagens.push(r); });
    registrosMaterialConsumo.forEach(r => { const om = r.om_detentora || r.organizacao; init(om); map[om].materialConsumo.push(r); });
    return map;
  }, [registrosDiaria, registrosVerbaOperacional, registrosPassagem, registrosMaterialConsumo]);

  const hasDataForReport = useMemo(() => {
    switch (selectedReport) {
      case 'logistico': return registrosClasseI.some(r => r.categoria === 'RACAO_QUENTE') || registrosClasseII.length > 0 || registrosClasseIII.length > 0;
      case 'racao_operacional': return registrosClasseI.some(r => r.categoria === 'RACAO_OPERACIONAL');
      case 'operacional': return registrosDiaria.length > 0 || registrosVerbaOperacional.length > 0 || registrosPassagem.length > 0 || registrosMaterialConsumo.length > 0 || registrosServicosTerceiros.length > 0;
      case 'hora_voo': return registrosHorasVoo.length > 0;
      default: return false;
    }
  }, [selectedReport, registrosClasseI, registrosClasseII, registrosClasseIII, registrosDiaria, registrosVerbaOperacional, registrosPassagem, registrosMaterialConsumo, registrosServicosTerceiros, registrosHorasVoo]);

  const renderReport = () => {
    if (!ptrabData) return null;
    if (!hasDataForReport) return <NoDataFallback reportName={currentReportOption.label} message="Não há dados registrados para este relatório." />;

    switch (selectedReport) {
      case 'logistico':
        return <PTrabLogisticoReport ptrabData={ptrabData} registrosClasseI={registrosClasseI} registrosClasseII={registrosClasseII} registrosClasseIII={registrosClasseIII} nomeRM={nomeRM} omsOrdenadas={omsOrdenadas} gruposPorOM={gruposPorOM} calcularTotaisPorOM={() => ({})} fileSuffix={currentReportOption.fileSuffix} generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculoUnificada} generateClasseIIMemoriaCalculo={generateClasseIIMemoriaCalculo} generateClasseVMemoriaCalculo={(r) => generateClasseIIMemoriaCalculo(r, false)} generateClasseVIMemoriaCalculo={(r) => generateClasseIIMemoriaCalculo(r, false)} generateClasseVIIMemoriaCalculo={(r) => generateClasseIIMemoriaCalculo(r, false)} generateClasseVIIIMemoriaCalculo={(r) => generateClasseIIMemoriaCalculo(r, false)} />;
      case 'racao_operacional':
        return <PTrabRacaoOperacionalReport ptrabData={ptrabData} registrosClasseI={registrosClasseI} fileSuffix={currentReportOption.fileSuffix} generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculoUnificada} />;
      case 'operacional':
        return <PTrabOperacionalReport ptrab={ptrabData} diarias={registrosDiaria} passagens={registrosPassagem} verbaOperacional={registrosVerbaOperacional} concessionarias={registrosConcessionaria} horasVoo={registrosHorasVoo} materialConsumo={registrosMaterialConsumo} complementoAlimentacao={registrosComplementoAlimentacao} servicosTerceiros={registrosServicosTerceiros} materialPermanente={[]} />;
      case 'hora_voo':
        return <PTrabHorasVooReport ptrabData={ptrabData} omsOrdenadas={Object.keys(gruposOperacionaisPorOM)} gruposPorOM={{} as any} fileSuffix={currentReportOption.fileSuffix} />;
      default:
        return <div className="text-center py-12">Relatório em desenvolvimento.</div>;
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary h-8 w-8" /><span className="ml-3 text-muted-foreground">Carregando...</span></div>;

  return (
    <div className="min-h-screen bg-background">
      <PageMetadata title="Relatórios P Trab" description="Gerenciador de Relatórios do P Trab" canonicalPath="/ptrab/relatorios" />
      <div className="print:hidden sticky top-0 z-50 bg-background border-b shadow-sm">
        <div className="container max-w-7xl mx-auto py-4 px-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/ptrab')}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
          <div className="flex items-center gap-4">
            <Select value={selectedReport} onValueChange={(v) => setSelectedReport(v as ReportType)}>
              <SelectTrigger className="w-[320px]"><SelectValue /></SelectTrigger>
              <SelectContent>{REPORT_OPTIONS.map(o => (<SelectItem key={o.value} value={o.value}><div className="flex items-center gap-2"><o.icon className={`h-4 w-4 ${o.iconClass}`} />{o.label}</div></SelectItem>))}</SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="container max-w-7xl mx-auto py-8 px-4">
        {renderReport()}
      </div>
    </div>
  );
};

const NoDataFallback = ({ reportName, message }: { reportName: string, message: string }) => (
    <div className="text-center py-16 border border-dashed rounded-lg bg-muted/20">
        <Frown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold">{reportName}</h3>
        <p className="text-muted-foreground mt-2">{message}</p>
    </div>
);

export default PTrabReportManager;