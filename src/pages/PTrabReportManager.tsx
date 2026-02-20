"use client";

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FileText, Package, Utensils, Briefcase, HardHat, Plane, ClipboardList, Frown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { fetchFullReportData } from "@/integrations/supabase/api";
import { fetchDiretrizesOperacionais, fetchDiretrizesPassagens } from "@/lib/ptrabUtils";
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
import { 
  calculateDiariaTotals,
  DestinoDiaria,
  QuantidadesPorPosto,
} from "@/lib/diariaUtils"; 
import { 
  generateDiariaMemoriaCalculo as generateDiariaMemoriaCalculoUtility, 
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
import { Tables, Json } from "@/integrations/supabase/types"; 
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";

// =================================================================
// EXPORTS E UTILITÁRIOS PARA OS RELATÓRIOS (Restaurados)
// =================================================================

export interface PTrabData extends Tables<'p_trab'> {
  origem: string;
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
}

export interface VerbaOperacionalRegistro extends Tables<'verba_operacional_registros'> {}
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

export interface HorasVooRegistro extends Tables<'horas_voo_registros'> {}

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

export const normalizarNome = (valor?: string) =>
  (valor || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const getOMPriority = (nomeOM: string, nomeRM: string): 1 | 2 | 3 => {
  const om = normalizarNome(nomeOM);
  const rm = normalizarNome(nomeRM);
  if (om === rm || /^\d+ª?\s*RM$/.test(om) || om.includes('REGIAO MILITAR') || rm.includes(om) || om.includes('RM')) return 1;
  if (om.includes('BDA') || om.includes('BRIGADA')) return 2;
  return 3;
};

export const isRegiaoMilitar = (nomeOM: string, nomeRM: string) => {
  const om = normalizarNome(nomeOM);
  const rm = normalizarNome(nomeRM);
  if (om === rm) return true;
  if (/^\d+ª?\s*RM$/.test(om) || om.includes('REGIAO MILITAR')) return true;
  if (rm.includes(om)) return true;
  return false;
};

// Funções de Memória de Cálculo (Nomes exatos esperados pelos componentes)

export const generateClasseIMemoriaCalculo = (registro: any, tipo: 'QS' | 'QR' | 'OP'): string => {
    if (registro.categoria === 'RACAO_OPERACIONAL') {
        if (tipo === 'OP') {
            if (registro.memoria_calculo_op_customizada) return registro.memoria_calculo_op_customizada;
            return generateRacaoOperacionalMemoriaCalculo(registro);
        }
        return "N/A";
    }
    const { qs, qr } = generateRacaoQuenteMemoriaCalculo(registro);
    if (tipo === 'QS') return registro.memoria_calculo_qs_customizada || qs;
    return registro.memoria_calculo_qr_customizada || qr;
};

export const generateClasseIIMemoriaCalculo = (registro: any, isClasseII: boolean = true): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) return generateClasseIXUtility(registro);
    if (isClasseII) return generateClasseIIUtility(registro.categoria, registro.itens_equipamentos, registro.dias_operacao, registro.om_detentora || registro.organizacao, registro.ug_detentora || registro.ug, registro.fase_atividade, registro.efetivo || 0, registro.valor_nd_30, registro.valor_nd_39);
    if (CLASSE_V_CATEGORIES.includes(registro.categoria)) return generateClasseVUtility(registro.categoria, registro.itens_equipamentos, registro.dias_operacao, registro.om_detentora || registro.organizacao, registro.ug_detentora || registro.ug, registro.fase_atividade, registro.efetivo || 0, registro.valor_nd_30, registro.valor_nd_39);
    if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) return generateClasseVIUtility(registro.categoria, registro.itens_equipamentos, registro.dias_operacao, registro.om_detentora || registro.organizacao, registro.ug_detentora || registro.ug, registro.fase_atividade, registro.efetivo || 0, registro.valor_nd_30, registro.valor_nd_39);
    if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) return generateClasseVIIUtility(registro.categoria, registro.itens_equipamentos, registro.dias_operacao, registro.om_detentora || registro.organizacao, registro.ug_detentora || registro.ug, registro.fase_atividade, registro.efetivo || 0, registro.valor_nd_30, registro.valor_nd_39);
    if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
        const itens = registro.categoria === 'Saúde' ? registro.itens_saude : registro.itens_remonta;
        return generateClasseVIIIUtility(registro.categoria, itens, registro.dias_operacao, registro.om_detentora || registro.organizacao, registro.ug_detentora || registro.ug, registro.fase_atividade, registro.efetivo || 0, registro.valor_nd_30, registro.valor_nd_39, registro.animal_tipo);
    }
    return registro.detalhamento || "Memória não disponível.";
};

export const generateClasseVMemoriaCalculo = (registro: any): string => generateClasseIIMemoriaCalculo(registro, false);
export const generateClasseVIMemoriaCalculo = (registro: any): string => generateClasseIIMemoriaCalculo(registro, false);
export const generateClasseVIIMemoriaCalculo = (registro: any): string => generateClasseIIMemoriaCalculo(registro, false);
export const generateClasseVIIIMemoriaCalculo = (registro: any): string => generateClasseIIMemoriaCalculo(registro, false);

export const generateClasseIXMemoriaCalculo = (registro: any): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    return generateClasseIXUtility(registro);
};

export const calculateItemTotalClasseIX = (item: any, diasOperacao: number): number => {
    return calculateItemTotalClasseIXUtility(item, diasOperacao);
};

export const generateDiariaMemoriaCalculo = (registro: any, diretrizesOp: any): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    const totals = calculateDiariaTotals(registro, diretrizesOp);
    return generateDiariaMemoriaCalculoUtility(registro, diretrizesOp, totals);
};

export const generateVerbaOperacionalMemoriaCalculo = (registro: any): string => registro.detalhamento_customizado || generateVerbaOperacionalMemoriaCalculoUtility(registro);
export const generateSuprimentoFundosMemoriaCalculo = (registro: any): string => registro.detalhamento_customizado || generateSuprimentoFundosMemoriaCalculoUtility(registro);
export const generatePassagemMemoriaCalculo = (registro: any): string => registro.detalhamento_customizado || generatePassagemMemoriaCalculo(registro);
export const generateConcessionariaMemoriaCalculo = (registro: any): string => registro.detalhamento_customizado || generateConcessionariaMemoriaCalculoUtility(registro);
export const generateMaterialConsumoMemoriaCalculo = (registro: any): string => registro.detalhamento_customizado || generateMaterialConsumoMemoriaCalculoUtility(registro, registro);
export const generateComplementoMemoriaCalculo = (registro: any, subType?: 'QS' | 'QR'): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    const full = generateComplementoMemoriaCalculoUtility(registro, registro);
    if (registro.categoria_complemento === 'genero' && subType) {
        const parts = full.split("\n\n--- DIVISOR_MEMORIA ---\n\n");
        return subType === 'QS' ? (parts[0] || "") : (parts[1] || "");
    }
    return full;
};
export const generateServicoMemoriaCalculo = (registro: any): string => registro.detalhamento_customizado || generateServicoMemoriaCalculoUtility(registro, registro);

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

type ReportType = 'logistico' | 'racao_operacional' | 'operacional' | 'material_permanente' | 'hora_voo' | 'dor';

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
  const [selectedReport, setSelectedReport] = useState<ReportType>('logistico');
  const [selectedDorId, setSelectedDorId] = useState<string | null>(null);

  const { data: masterData, isLoading: loading } = useQuery({
    queryKey: ['ptrabFullReport', ptrabId],
    queryFn: async () => {
      if (!ptrabId) return null;
      const data = await fetchFullReportData(ptrabId) as any;
      const year = new Date(data.p_trab.periodo_inicio).getFullYear();
      const [diretrizesOp, diretrizesPassagens] = await Promise.all([
        fetchDiretrizesOperacionais(year),
        fetchDiretrizesPassagens(year)
      ]);
      return { ...data, diretrizesOp, diretrizesPassagens };
    },
    enabled: !!ptrabId,
    staleTime: 1000 * 60 * 10,
  });

  const processedData = useMemo(() => {
    if (!masterData) return null;
    const { p_trab, classe_i, classe_ii, classe_iii, classe_v, classe_vi, classe_vii, classe_viii_saude, classe_viii_remonta, classe_ix, diarias, passagens, verba_operacional, concessionarias, material_consumo, material_permanente, servicos_terceiros, complemento_alimentacao, dor, ref_lpc, diretrizesOp, diretrizesPassagens } = masterData;

    const registrosClasseI = (classe_i || []).map((r: any) => ({
        ...r,
        diasOperacao: r.dias_operacao,
        faseAtividade: r.fase_atividade,
        omQS: r.om_qs,
        ugQS: r.ug_qs,
        nrRefInt: r.nr_ref_int,
        valorQS: Number(r.valor_qs),
        valorQR: Number(r.valor_qr),
        quantidadeR2: r.quantidade_r2 || 0,
        quantidadeR3: r.quantidade_r3 || 0,
        totalQS: Number(r.total_qs),
        totalQR: Number(r.total_qr),
        totalGeral: Number(r.total_geral),
        complementoQS: Number(r.complemento_qs),
        etapaQS: Number(r.etapa_qs),
        complementoQR: Number(r.complemento_qr),
        etapaQR: Number(r.etapa_qr),
        memoriaQSCustomizada: r.memoria_calculo_qs_customizada,
        memoriaQRCustomizada: r.memoria_calculo_qr_customizada,
        calculos: calculateClasseICalculations(r.efetivo, r.dias_operacao, r.nr_ref_int || 0, Number(r.valor_qs), Number(r.valor_qr)),
    }));

    const registrosClasseII = [
        ...(classe_ii || []).map((r: any) => ({ ...r, efetivo: r.efetivo || 0 })),
        ...(classe_v || []).map((r: any) => ({ ...r, efetivo: r.efetivo || 0 })),
        ...(classe_vi || []).map((r: any) => ({ ...r, efetivo: r.efetivo || 0 })),
        ...(classe_vii || []).map((r: any) => ({ ...r, efetivo: r.efetivo || 0 })),
        ...(classe_viii_saude || []).map((r: any) => ({ ...r, itens_equipamentos: r.itens_saude, categoria: 'Saúde', efetivo: r.efetivo || 0 })),
        ...(classe_viii_remonta || []).map((r: any) => ({ ...r, itens_remonta: r.itens_remonta, categoria: 'Remonta/Veterinária', efetivo: r.efetivo || 0 })),
        ...(classe_ix || []).map((r: any) => ({ ...r, itens_equipamentos: r.itens_motomecanizacao, efetivo: r.efetivo || 0 })),
    ];

    const allVerba = (verba_operacional || []).map((r: any) => ({
        ...r,
        valor_total_solicitado: Number(r.valor_total_solicitado || 0),
        valor_nd_30: Number(r.valor_nd_30 || 0),
        valor_nd_39: Number(r.valor_nd_39 || 0),
    }));

    return {
        ptrabData: p_trab as PTrabData,
        registrosClasseI,
        registrosClasseII,
        registrosClasseIII: (classe_iii || []).map((r: any) => ({ ...r, itens_equipamentos: r.itens_equipamentos || null })),
        registrosDiaria: (diarias || []).map((r: any) => ({ ...r, valor_total: Number(r.valor_total || 0) })),
        registrosVerbaOperacional: allVerba.filter((r: any) => r.detalhamento !== 'Suprimento de Fundos'),
        registrosSuprimentoFundos: allVerba.filter((r: any) => r.detalhamento === 'Suprimento de Fundos'),
        registrosPassagem: (passagens || []).map((r: any) => ({ ...r, valor_total: Number(r.valor_total || 0) })),
        registrosConcessionaria: (concessionarias || []).map((r: any) => ({ ...r, valor_total: Number(r.valor_total || 0) })),
        registrosMaterialConsumo: (material_consumo || []).map((r: any) => ({ ...r, valor_total: Number(r.valor_total || 0) })),
        registrosComplementoAlimentacao: (complemento_alimentacao || []).map((r: any) => ({ ...r, valor_total: Number(r.valor_total || 0) })),
        registrosServicosTerceiros: (servicos_terceiros || []).map((r: any) => ({ ...r, valor_total: Number(r.valor_total || 0) })),
        registrosMaterialPermanente: (material_permanente || []).map((r: any) => ({ ...r, valor_total: Number(r.valor_total || 0) })),
        registrosHorasVoo: (masterData.horas_voo || []).map((r: any) => ({ ...r, valor_total: Number(r.valor_total || 0) })),
        registrosDOR: dor || [],
        refLPC: ref_lpc as RefLPC,
        diretrizesOperacionais: diretrizesOp,
        diretrizesPassagens: diretrizesPassagens,
        nomeRM: p_trab.rm_vinculacao || ''
    };
  }, [masterData]);

  const reportContext = useMemo(() => {
    if (!processedData) return null;
    const { registrosClasseI, registrosClasseII, nomeRM } = processedData;
    const grupos: Record<string, GrupoOM> = {};
    const initializeGroup = (name: string) => { if (!grupos[name]) grupos[name] = { linhasQS: [], linhasQR: [], linhasClasseII: [], linhasClasseV: [], linhasClasseVI: [], linhasClasseVII: [], linhasClasseVIII: [], linhasClasseIX: [], linhasClasseIII: [], linhasConcessionaria: [] }; };

    registrosClasseI.filter(r => r.categoria === 'RACAO_QUENTE').forEach((registro) => {
        initializeGroup(registro.omQS || registro.organizacao);
        grupos[registro.omQS || registro.organizacao].linhasQS.push({ registro, tipo: 'QS', valor_nd_30: registro.totalQS, valor_nd_39: 0 });
        initializeGroup(registro.organizacao);
        grupos[registro.organizacao].linhasQR.push({ registro, tipo: 'QR', valor_nd_30: registro.totalQR, valor_nd_39: 0 });
    });

    registrosClasseII.forEach((registro) => {
        initializeGroup(registro.organizacao);
        const linha = { registro, valor_nd_30: registro.valor_nd_30, valor_nd_39: registro.valor_nd_39 };
        if (CLASSE_V_CATEGORIES.includes(registro.categoria)) grupos[registro.organizacao].linhasClasseV.push(linha);
        else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) grupos[registro.organizacao].linhasClasseVI.push(linha);
        else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) grupos[registro.organizacao].linhasClasseVII.push(linha);
        else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) grupos[registro.organizacao].linhasClasseVIII.push(linha);
        else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) grupos[registro.organizacao].linhasClasseIX.push(linha);
        else grupos[registro.organizacao].linhasClasseII.push(linha);
    });

    const gruposOp: Record<string, GrupoOMOperacional> = {};
    const initializeOpGroup = (name: string) => { if (!gruposOp[name]) gruposOp[name] = { diarias: [], verbaOperacional: [], suprimentoFundos: [], passagens: [], concessionarias: [], materialConsumo: [], complementoAlimentacao: [], servicosTerceiros: [] }; };
    processedData.registrosDiaria.forEach(r => { initializeOpGroup(r.organizacao); gruposOp[r.organizacao].diarias.push(r); });
    processedData.registrosVerbaOperacional.forEach(r => { initializeOpGroup(r.om_detentora || r.organizacao); gruposOp[r.om_detentora || r.organizacao].verbaOperacional.push(r); });
    processedData.registrosPassagem.forEach(r => { initializeOpGroup(r.om_detentora || r.organizacao); gruposOp[r.om_detentora || r.organizacao].passagens.push(r); });
    processedData.registrosConcessionaria.forEach(r => { initializeOpGroup(r.om_detentora || r.organizacao); gruposOp[r.om_detentora || r.organizacao].concessionarias.push(r); });
    processedData.registrosMaterialConsumo.forEach(r => { initializeOpGroup(r.om_detentora || r.organizacao); gruposOp[r.om_detentora || r.organizacao].materialConsumo.push(r); });
    processedData.registrosServicosTerceiros.forEach(r => { initializeOpGroup(r.om_detentora || r.organizacao); gruposOp[r.om_detentora || r.organizacao].servicosTerceiros.push(r); });

    const omsOrdenadas = Object.keys(grupos).sort((a, b) => { const aP = getOMPriority(a, nomeRM); const bP = getOMPriority(b, nomeRM); return aP !== bP ? aP - bP : a.localeCompare(b); });
    const omsOpOrdenadas = Object.keys(gruposOp).sort((a, b) => { const aP = getOMPriority(a, nomeRM); const bP = getOMPriority(b, nomeRM); return aP !== bP ? aP - bP : a.localeCompare(b); });

    return { grupos, gruposOp, omsOrdenadas, omsOpOrdenadas };
  }, [processedData]);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="ml-2 text-muted-foreground">Carregando dados do P Trab...</span></div>;
  if (!processedData || !reportContext) return null;

  const renderReport = () => {
    const { ptrabData, registrosClasseI, registrosClasseII, registrosClasseIII, registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, registrosConcessionaria, registrosMaterialConsumo, registrosComplementoAlimentacao, registrosServicosTerceiros, registrosMaterialPermanente, registrosHorasVoo, registrosDOR, diretrizesOperacionais, diretrizesPassagens, nomeRM } = processedData;
    const { grupos, gruposOp, omsOrdenadas, omsOpOrdenadas } = reportContext;

    switch (selectedReport) {
      case 'logistico':
        return <PTrabLogisticoReport ptrabData={ptrabData} registrosClasseI={registrosClasseI} registrosClasseII={registrosClasseII} registrosClasseIII={registrosClasseIII} nomeRM={nomeRM} omsOrdenadas={omsOrdenadas} gruposPorOM={grupos} calcularTotaisPorOM={() => ({})} fileSuffix="Aba Log" generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculo} generateClasseIIMemoriaCalculo={generateClasseIIMemoriaCalculo} generateClasseVMemoriaCalculo={generateClasseVMemoriaCalculo} generateClasseVIMemoriaCalculo={generateClasseVIMemoriaCalculo} generateClasseVIIMemoriaCalculo={generateClasseVIIMemoriaCalculo} generateClasseVIIIMemoriaCalculo={generateClasseVIIIMemoriaCalculo} />;
      case 'racao_operacional':
        return <PTrabRacaoOperacionalReport ptrabData={ptrabData} registrosClasseI={registrosClasseI} fileSuffix="Aba Rç Op" generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculo} />;
      case 'operacional':
        return <PTrabOperacionalReport ptrabData={ptrabData} omsOrdenadas={omsOpOrdenadas} gruposPorOM={gruposOp} registrosDiaria={registrosDiaria} registrosVerbaOperacional={registrosVerbaOperacional} registrosSuprimentoFundos={registrosSuprimentoFundos} registrosPassagem={registrosPassagem} registrosConcessionaria={registrosConcessionaria} registrosMaterialConsumo={registrosMaterialConsumo} registrosComplementoAlimentacao={registrosComplementoAlimentacao} registrosServicosTerceiros={registrosServicosTerceiros} diretrizesOperacionais={diretrizesOperacionais} diretrizesPassagens={diretrizesPassagens} fileSuffix="Aba Op" generateDiariaMemoriaCalculo={(r) => generateDiariaMemoriaCalculo(r, diretrizesOperacionais)} generateVerbaOperacionalMemoriaCalculo={generateVerbaOperacionalMemoriaCalculo} generateSuprimentoFundosMemoriaCalculo={generateSuprimentoFundosMemoriaCalculo} generatePassagemMemoriaCalculo={generatePassagemMemoriaCalculo} generateConcessionariaMemoriaCalculo={generateConcessionariaMemoriaCalculo} generateMaterialConsumoMemoriaCalculo={generateMaterialConsumoMemoriaCalculo} generateComplementoMemoriaCalculo={generateComplementoMemoriaCalculo} generateServicoMemoriaCalculo={generateServicoMemoriaCalculo} />;
      case 'material_permanente':
        return <PTrabMaterialPermanenteReport ptrabData={ptrabData} registrosMaterialPermanente={registrosMaterialPermanente} fileSuffix="Aba Mat Perm" />;
      case 'hora_voo':
        return <PTrabHorasVooReport ptrabData={ptrabData} omsOrdenadas={[]} gruposPorOM={{}} fileSuffix="Aba HV" />;
      case 'dor':
        const selectedDor = registrosDOR.find((d: any) => d.id === selectedDorId) || registrosDOR[0];
        return <PTrabDORReport ptrabData={ptrabData} dorData={selectedDor} selector={registrosDOR.length > 1 ? <Select value={selectedDorId || ''} onValueChange={setSelectedDorId}><SelectTrigger className="w-[300px] bg-white"><SelectValue placeholder="Escolha o DOR" /></SelectTrigger><SelectContent>{registrosDOR.map((dor: any) => <SelectItem key={dor.id} value={dor.id}>DOR Nr {dor.numero_dor || 'S/N'} - {new Date(dor.created_at).toLocaleDateString()}</SelectItem>)}</SelectContent></Select> : null} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden sticky top-0 z-50 bg-background border-b border-border/50 shadow-sm">
        <div className="container max-w-7xl mx-auto py-4 px-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/ptrab')}><ArrowLeft className="mr-2 h-4 w-4" />Voltar para Gerenciamento</Button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Relatório:</span></div>
            <Select value={selectedReport} onValueChange={(value) => setSelectedReport(value as ReportType)}>
              <SelectTrigger className="w-[320px]"><SelectValue placeholder="Selecione o Relatório" /></SelectTrigger>
              <SelectContent>{REPORT_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}><div className="flex items-center gap-2"><option.icon className={`h-4 w-4 ${option.iconClass}`} />{option.label}</div></SelectItem>))}</SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="container max-w-7xl mx-auto py-4 px-4">{renderReport()}</div>
    </div>
  );
};

export default PTrabReportManager;