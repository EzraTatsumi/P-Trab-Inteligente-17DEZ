"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FileText, Package, Utensils, Briefcase, HardHat, Plane, ClipboardList, Frown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner"; 
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
import PTrabOperacionalReport from "@/components/reports/PTrabOperacionalReport"; 
import PTrabHorasVooReport from "@/components/reports/PTrabHorasVooReport"; 
import PTrabMaterialPermanenteReport from "@/components/reports/PTrabMaterialPermanenteReport";
import PTrabDORReport from "@/components/reports/PTrabDORReport";
import {
  generateRacaoQuenteMemoriaCalculo,
  generateRacaoOperacionalMemoriaCalculo,
  calculateClasseICalculations,
  ClasseIRegistro as ClasseIRegistroType,
} from "@/lib/classeIUtils";
import { generateClasseIIMemoriaCalculo as generateClasseIIUtility } from "@/lib/classeIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVUtility } from "@/lib/classeVUtils";
import { generateCategoryMemoriaCalculo as generateClasseIIUtility as generateClasseVIUtility } from "@/lib/classeVIUtils";
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
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { Tables, Json } from "@/integrations/supabase/types"; 
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { GHOST_DATA, isGhostMode } from "@/lib/ghostStore";
import { runMission06 } from "@/tours/missionTours";
import { cn } from "@/lib/utils";

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

export interface PTrabOperacionalReportProps {
    ptrabData: PTrabData;
    omsOrdenadas: string[];
    gruposPorOM: Record<string, GrupoOMOperacional>;
    registrosDiaria: DiariaRegistro[];
    registrosVerbaOperacional: VerbaOperacionalRegistro[];
    registrosSuprimentoFundos: VerbaOperacionalRegistro[];
    registrosPassagem: PassagemRegistro[];
    registrosConcessionaria: ConcessionariaRegistro[];
    registrosMaterialConsumo: MaterialConsumoRegistro[]; 
    registrosComplementoAlimentacao: ComplementoAlimentacaoRegistro[];
    registrosServicosTerceiros: ServicoTerceiroRegistro[];
    diretrizesOperacionais: Tables<'diretrizes_operacionais'> | null;
    diretrizesPassagens: Tables<'diretrizes_passagens'>[]; 
    fileSuffix: string;
    generateDiariaMemoriaCalculo: (registro: DiariaRegistro, diretrizesOp: Tables<'diretrizes_operacionais'> | null) => string;
    generateVerbaOperacionalMemoriaCalculo: (registro: VerbaOperacionalRegistro) => string;
    generateSuprimentoFundosMemoriaCalculo: (registro: VerbaOperacionalRegistro) => string;
    generatePassagemMemoriaCalculo: (registro: PassagemRegistro) => string;
    generateConcessionariaMemoriaCalculo: (registro: ConcessionariaRegistro) => string;
    generateMaterialConsumoMemoriaCalculo: (registro: MaterialConsumoRegistro) => string; 
    generateComplementoMemoriaCalculo: (registro: ComplementoAlimentacaoRegistro, subType?: 'QS' | 'QR') => string;
    generateServicoMemoriaCalculo: (registro: ServicoTerceiroRegistro) => string;
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
    if (registro.detalhamento_customizado) {
      return registro.detalhamento_customizado;
    }
    return generateClasseIXUtility(registro as any);
};

export const generateClasseIMemoriaCalculoUnificada = (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP'): string => {
    if (registro.categoria === 'RACAO_OPERACIONAL') {
        if (tipo === 'OP') {
            if (registro.memoria_calculo_op_customizada && registro.memoria_calculo_op_customizada.trim().length > 0) {
                return registro.memoria_calculo_op_customizada;
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
                nrCiclos: calculateClasseICalculations(registro.efetivo, registro.dias_operacao, registro.nrRefInt || 0, registro.valorQS || 0, registro.valorQR || 0).nrCiclos,
                diasEtapaPaga: 0,
                diasEtapaSolicitada: calculateClasseICalculations(registro.efetivo, registro.dias_operacao, registro.nrRefInt || 0, registro.valorQS || 0, registro.valorQR || 0).diasEtapaSolicitada,
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
                nrCiclos: calculateClasseICalculations(registro.efetivo, registro.dias_operacao, registro.nrRefInt || 0, registro.valorQS || 0, registro.valorQR || 0).nrCiclos,
                diasEtapaPaga: 0,
                diasEtapaSolicitada: calculateClasseICalculations(registro.efetivo, registro.dias_operacao, registro.nrRefInt || 0, registro.valorQS || 0, registro.valorQR || 0).diasEtapaSolicitada,
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
            registro.categoria as 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento',
            registro.itens_equipamentos as any as ItemClasseII[], 
            registro.dias_operacao,
            registro.om_detentora || registro.organizacao,
            registro.ug_detentora || registro.ug,
            registro.fase_atividade,
            registro.efetivo || 0,
            registro.valor_nd_30,
            registro.valor_nd_39
        );
    }
    
    if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
        return generateClasseVUtility(
            registro.categoria as 'Armt L' | 'Armt P' | 'IODCT' | 'DQBRN',
            registro.itens_equipamentos as any as ItemClasseII[], 
            registro.dias_operacao,
            registro.om_detentora || registro.organizacao,
            registro.ug_detentora || registro.ug,
            registro.fase_atividade,
            registro.efetivo || 0,
            registro.valor_nd_30,
            registro.valor_nd_39
        );
    }
    
    if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
        return generateClasseVIUtility(
            registro.categoria as 'Gerador' | 'Embarcação' | 'Equipamento de Engenharia',
            registro.itens_equipamentos as any as ItemClasseII[], 
            registro.dias_operacao,
            registro.om_detentora || registro.organizacao,
            registro.ug_detentora || registro.ug,
            registro.fase_atividade,
            registro.efetivo || 0,
            registro.valor_nd_30,
            registro.valor_nd_39
        );
    }
    
    if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
        return generateClasseVIIUtility(
            registro.categoria as 'Comunicações' | 'Informática',
            registro.itens_equipamentos as any as ItemClasseII[], 
            registro.dias_operacao,
            registro.om_detentora || registro.organizacao,
            registro.ug_detentora || registro.ug,
            registro.fase_atividade,
            registro.efetivo || 0,
            registro.valor_nd_30,
            registro.valor_nd_39
        );
    }
    
    if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
        const itens = registro.categoria === 'Saúde' ? registro.itens_saude : registro.itens_remonta;
        
        return generateClasseVIIIUtility(
            registro.categoria as 'Saúde' | 'Remonta/Veterinária',
            itens as any, 
            registro.dias_operacao,
            registro.om_detentora || registro.organizacao,
            registro.ug_detentora || registro.ug,
            registro.fase_atividade,
            registro.efetivo || 0,
            registro.valor_nd_30,
            registro.valor_nd_39,
            registro.animal_tipo
        );
    }
    
    return registro.detalhamento || "Memória de cálculo não disponível.";
};

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

    const totals = calculateDiariaTotals(registro, diretrizesOp);
    
    return generateDiariaMemoriaCalculoUtility(registro, diretrizesOp, totals);
};

export const generateVerbaOperacionalMemoriaCalculada = (
    registro: VerbaOperacionalRegistro
): string => {
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
        return registro.detalhamento_customizado;
    }
    return generateVerbaOperacionalMemoriaCalculoUtility(registro as any);
};

export const generateSuprimentoFundosMemoriaCalculada = (
    registro: VerbaOperacionalRegistro
): string => {
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
        return registro.detalhamento_customizado;
    }
    return generateSuprimentoFundosMemoriaCalculoUtility(registro as any);
};

export const generatePassagemMemoriaCalculada = (
    registro: PassagemRegistro
): string => {
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
        return registro.detalhamento_customizado;
    }
    return generatePassagemMemoriaCalculo(registro);
};

export const generateConcessionariaMemoriaCalculada = (
    registro: ConcessionariaRegistro
): string => {
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
        return registro.detalhamento_customizado;
    }
    return generateConcessionariaMemoriaCalculoUtility(registro);
};

/**
 * Função unificada para gerar a memória de cálculo de Material de Consumo, priorizando o customizado.
 */
export const generateMaterialConsumoMemoriaCalculada = (
    registro: MaterialConsumoRegistro
): string => {
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
        return registro.detalhamento_customizado;
    }
    
    const context = {
        organizacao: registro.organizacao,
        efetivo: registro.efetivo,
        dias_operacao: registro.dias_operacao,
        fase_atividade: registro.fase_atividade
    };
    
    return generateMaterialConsumoMemoriaCalculoUtility(registro, context);
};

/**
 * Função unificada para gerar a memória de cálculo de Complemento de Alimentação.
 */
export const generateComplementoMemoriaCalculada = (
    registro: ComplementoAlimentacaoRegistro,
    subType?: 'QS' | 'QR'
): string => {
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
        return registro.detalhamento_customizado;
    }
    
    const context = {
        organizacao: registro.organizacao,
        efetivo: registro.efetivo,
        dias_operacao: registro.dias_operacao,
        fase_atividade: registro.fase_atividade
    };
    
    const fullMemoria = generateComplementoMemoriaCalculoUtility(registro, context);
    
    if (registro.categoria_complemento === 'genero' && subType) {
        const parts = fullMemoria.split("\n\n--- DIVISOR_MEMORIA ---\n\n");
        return subType === 'QS' ? (parts[0] || "") : (parts[1] || "");
    }
    
    return fullMemoria;
};

/**
 * Função unificada para gerar a memória de cálculo de Serviços de Terceiros.
 */
export const generateServicoMemoriaCalculada = (
    registro: ServicoTerceiroRegistro
): string => {
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
        return registro.detalhamento_customizado;
    }
    
    const context = {
        organizacao: registro.organizacao,
        efetivo: registro.efetivo,
        dias_operacao: registro.dias_operacao,
        fase_atividade: registro.fase_atividade
    };
    
    return generateServicoMemoriaCalculoUtility(registro, context);
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

const getOMPriority = (nomeOM: string, nomeRM: string): 1 | 2 | 3 => {
  const om = normalizarNome(nomeOM);
  const rm = normalizarNome(nomeRM);

  if (om === rm || /^\d+ª?\s*RM$/.test(om) || om.includes('REGIAO MILITAR') || rm.includes(om) || om.includes('RM')) {
    return 1;
  }
  
  if (om.includes('BDA') || om.includes('BRIGADA')) {
    return 2;
  }

  return 3;
};

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
  { value: 'operacional', label: 'P Trab Operacional', icon: Briefcase, iconClass: 'text-blue-500', fileSuffix: 'Aba Op' }, 
  { value: 'material_permanente', label: 'P Trab Material Permanente', icon: HardHat, iconClass: 'text-green-500', fileSuffix: 'Aba Mat Perm' },
  { value: 'hora_voo', label: 'P Trab Hora de Voo', icon: Plane, iconClass: 'text-purple-500', fileSuffix: 'Aba HV' },
  { value: 'dor', label: 'DOR', icon: ClipboardList, iconClass: 'text-gray-500', fileSuffix: 'Aba DOR' },
];

// =================================================================
// COMPONENTE DE FALLBACK PADRONIZADO
// =================================================================

interface NoDataFallbackProps {
    reportName: string;
    message: string;
}

const NoDataFallback: React.FC<NoDataFallbackProps> = ({ reportName, message }) => (
    <div className="text-center py-16 border border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
        <Frown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-foreground">
            {reportName}
        </h3>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            {message}
        </p>
        <p className="text-sm text-muted-foreground mt-4">
            Verifique se o P Trab possui registros de classes ou itens operacionais relacionados.
        </p>
    </div>
);

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

const PTrabReportManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const ghost = isGhostMode();
  
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
  const [registrosComplementoAlimentacaoRaw, setRegistrosComplementoAlimentacaoRaw] = useState<any[]>([]);
  const [registrosServicosTerceiros, setRegistrosServicosTerceiros] = useState<ServicoTerceiroRegistro[]>([]);
  const [registrosMaterialPermanente, setRegistrosMaterialPermanente] = useState<MaterialPermanenteRegistro[]>([]);
  const [registrosHorasVoo, setRegistrosHorasVoo] = useState<HorasVooRegistro[]>([]); 
  const [registrosDOR, setRegistrosDOR] = useState<any[]>([]);
  const [selectedDorId, setSelectedDorId] = useState<string | null>(null);
  const [diretrizesOperacionais, setDiretrizesOperacionais] = useState<Tables<'diretrizes_operacionais'> | null>(null);
  const [diretrizesPassagens, setDiretrizesPassagens] = useState<Tables<'diretrizes_passagens'>[]>([]);
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
  
  // ADICIONADO: Estado para gerir o cache em memória das abas
  const [fetchedReports, setFetchedReports] = useState<Set<ReportType>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportType>('logistico');

  const isLubrificante = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
  const isCombustivel = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';
  
  const currentReportOption = useMemo(() => REPORT_OPTIONS.find(r => r.value === selectedReport)!, [selectedReport]);

  // Lógica de inicialização do Tour (Missão 06)
  useEffect(() => {
    if (!loading) {
      const startTour = searchParams.get('startTour') === 'true';
      const missionId = localStorage.getItem('active_mission_id');
      if (startTour && missionId === '6' && ghost) {
        const timer = setTimeout(() => {
          runMission06(() => {
            const completed = JSON.parse(localStorage.getItem('completed_missions') || '[]');
            if (!completed.includes(6)) {
              localStorage.setItem('completed_missions', JSON.stringify([...completed, 6]));
            }
            navigate('/ptrab?showHub=true');
          });
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, searchParams, navigate, ghost]);

  const loadData = useCallback(async () => {
    if (!ptrabId && !ghost) {
      toast.error("P Trab não selecionado");
      navigate('/ptrab');
      return;
    }

    // Magia do Cache: Se já baixamos os dados deste relatório, ignoramos o processo e a tela abre na hora!
    if (fetchedReports.has(selectedReport) && ptrabData) {
        return;
    }

    setLoading(true);
    
    try {
      // 1. Busca os dados base do P Trab apenas na primeira vez
      let currentPtrab = ptrabData;
      if (!currentPtrab) {
          if (ghost) {
            currentPtrab = GHOST_DATA.p_trab_exemplo as any;
          } else {
            const { data: ptrab, error: ptrabError } = await supabase
                .from('p_trab')
                .select('*, updated_at, rm_vinculacao')
                .eq('id', ptrabId)
                .single();
            if (ptrabError || !ptrab) throw new Error("Não foi possível carregar o P Trab");
            currentPtrab = ptrab as PTrabData;
          }
          setPtrabData(currentPtrab);
      }

      const year = new Date(currentPtrab.periodo_inicio).getFullYear();
      
      // 2. Prepara variáveis para receber os dados
      let classeIData: any = null, classeIIData: any = null, classeVData: any = null,
          classeVIData: any = null, classeVIIData: any = null, classeVIIISaudeData: any = null,
          classeVIIIRemontaData: any = null, classeIXData: any = null, classeIIIData: any = null,
          refLPCData: any = null, diariaData: any = null, verbaOperacionalData: any = null,
          passagemData: any = null, concessionariaData: any = null, materialConsumoData: any = null,
          complementoAlimentacaoData: any = null, servicosTerceirosData: any = null,
          materialPermanenteData: any = null, horasVooData: any = null, dorData: any = null,
          diretrizesOpData: any = null, diretrizesPassagensData: any = null;

      // 3. Monta APENAS as requisições necessárias para a aba atual (Lazy Fetching)
      if (ghost) {
          // Dados Mockados para o Tour
          if (selectedReport === 'logistico' || selectedReport === 'racao_operacional') {
              classeIData = [{
                  id: 'ghost-cl1', p_trab_id: 'ghost', organizacao: '1º BIS', ug: '160222', categoria: 'RACAO_QUENTE',
                  efetivo: 150, dias_operacao: 15, nr_ref_int: 3, valor_qs: 15.50, valor_qr: 21.20,
                  total_qs: 34875, total_qr: 47700, total_geral: 82575, fase_atividade: 'Execução', om_qs: '1º BIS', ug_qs: '160222'
              }];
          }
          if (selectedReport === 'operacional') {
              diariaData = [{
                  id: 'ghost-diaria', p_trab_id: 'ghost', organizacao: '1º BIS', ug: '160222', destino: 'CAPITAL',
                  dias_operacao: 10, quantidades_por_posto: { 'OF_SUP': 2, 'OF_INT_SGT': 5 }, valor_total: 12500,
                  valor_nd_30: 12500, valor_nd_15: 0, valor_taxa_embarque: 0, is_aereo: false, fase_atividade: 'Execução'
              }];
              materialConsumoData = [{
                  id: 'ghost-mat', p_trab_id: 'ghost', organizacao: '1º BIS', ug: '160222', group_name: 'MATERIAL DE CONSTRUÇÃO',
                  valor_total: 1250.50, valor_nd_30: 1250.50, valor_nd_39: 0, dias_operacao: 15, efetivo: 150, fase_atividade: 'Execução'
              }];
          }
          if (selectedReport === 'dor') {
              dorData = [{
                  id: 'ghost-dor', p_trab_id: 'ghost', numero_dor: '01', created_at: new Date().toISOString(),
                  finalidade: 'Prover apoio logístico...', motivacao: 'Msg Op nº 196...', itens_dor: [
                      { uge_name: '1º BIS', uge_code: '160222', gnd: 3, valor_num: 1250.50, descricao: 'MATERIAL DE CONSUMO' }
                  ]
              }];
          }
      } else {
          const promises: Promise<void>[] = [];

          if (selectedReport === 'logistico' || selectedReport === 'racao_operacional') {
              promises.push(Promise.resolve(supabase.from('classe_i_registros').select('*, memoria_calculo_qs_customizada, memoria_calculo_qr_customizada, memoria_calculo_op_customizada, fase_atividade, categoria, quantidade_r2, quantidade_r3').eq('p_trab_id', ptrabId).then(({data}) => { classeIData = data; })));
          }

          if (selectedReport === 'logistico') {
              promises.push(Promise.resolve(supabase.from('classe_ii_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora, efetivo').eq('p_trab_id', ptrabId).then(({data}) => { classeIIData = data; })));
              promises.push(Promise.resolve(supabase.from('classe_v_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora, efetivo').eq('p_trab_id', ptrabId).then(({data}) => { classeVData = data; })));
              promises.push(Promise.resolve(supabase.from('classe_vi_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora').eq('p_trab_id', ptrabId).then(({data}) => { classeVIData = data; })));
              promises.push(Promise.resolve(supabase.from('classe_vii_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora').eq('p_trab_id', ptrabId).then(({data}) => { classeVIIData = data; })));
              promises.push(Promise.resolve(supabase.from('classe_viii_saude_registros').select('*, itens_saude, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora').eq('p_trab_id', ptrabId).then(({data}) => { classeVIIISaudeData = data; })));
              promises.push(Promise.resolve(supabase.from('classe_viii_remonta_registros').select('*, itens_remonta, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, animal_tipo, quantidade_animais, om_detentora, ug_detentora').eq('p_trab_id', ptrabId).then(({data}) => { classeVIIIRemontaData = data; })));
              promises.push(Promise.resolve(supabase.from('classe_ix_registros').select('*, itens_motomecanizacao, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora').eq('p_trab_id', ptrabId).then(({data}) => { classeIXData = data; })));
              promises.push(Promise.resolve(supabase.from('classe_iii_registros').select('*, detalhamento_customizado, itens_equipamentos, fase_atividade, consumo_lubrificante_litro, preco_lubrificante, valor_nd_30, valor_nd_39, om_detentora, ug_detentora').eq('p_trab_id', ptrabId).then(({data}) => { classeIIIData = data; })));
              promises.push(Promise.resolve(supabase.from("p_trab_ref_lpc").select("*").eq("p_trab_id", ptrabId).maybeSingle().then(({data}) => { refLPCData = data; })));
          }

          if (selectedReport === 'operacional') {
              promises.push(Promise.resolve(supabase.from('diaria_registros').select('*').eq('p_trab_id', ptrabId).then(({data}) => { diariaData = data; })));
              promises.push(Promise.resolve(supabase.from('verba_operacional_registros').select('*, objeto_aquisicao, objeto_contratacao, proposito, finalidade, local, tarefa').eq('p_trab_id', ptrabId).then(({data}) => { verbaOperacionalData = data; })));
              promises.push(Promise.resolve(supabase.from('passagem_registros').select('*').eq('p_trab_id', ptrabId).then(({data}) => { passagemData = data; })));
              promises.push(Promise.resolve(supabase.from('concessionaria_registros').select('*, diretriz_id').eq('p_trab_id', ptrabId).then(({data}) => { concessionariaData = data; })));
              promises.push(Promise.resolve(supabase.from('material_consumo_registros').select('*').eq('p_trab_id', ptrabId).then(({data}) => { materialConsumoData = data; })));
              promises.push(Promise.resolve(supabase.from('complemento_alimentacao_registros').select('*').eq('p_trab_id', ptrabId).then(({data}) => { complementoAlimentacaoData = data; })));
              promises.push(Promise.resolve(supabase.from('servicos_terceiros_registros' as any).select('*').eq('p_trab_id', ptrabId).then(({data}) => { servicosTerceirosData = data; })));
              promises.push(Promise.resolve(fetchDiretrizesOperacionais(year).then(data => { diretrizesOpData = data; })));
              promises.push(Promise.resolve(fetchDiretrizesPassagens(year).then(data => { diretrizesPassagensData = data; })));
          }

          if (selectedReport === 'material_permanente') {
              promises.push(Promise.resolve(supabase.from('material_permanente_registros' as any).select('*').eq('p_trab_id', ptrabId).then(({data}) => { materialPermanenteData = data; })));
          }

          if (selectedReport === 'hora_voo') {
              promises.push(Promise.resolve(supabase.from('horas_voo_registros').select('*').eq('p_trab_id', ptrabId).then(({data}) => { horasVooData = data; })));
          }

          if (selectedReport === 'dor') {
              promises.push(Promise.resolve(supabase.from('dor_registros' as any).select('*').eq('p_trab_id', ptrabId).order('created_at', { ascending: true }).then(({data}) => { dorData = data; })));
          }

          // Dispara apenas as requisições necessárias simultaneamente
          await Promise.all(promises);
      }

      // 4. Atualiza os estados com os dados obtidos
      if (diretrizesOpData !== null) setDiretrizesOperacionais(diretrizesOpData as Tables<'diretrizes_operacionais'>);
      if (diretrizesPassagensData !== null) setDiretrizesPassagens(diretrizesPassagensData as Tables<'diretrizes_passagens'>[]);
      if (refLPCData !== null) setRefLPC(refLPCData as RefLPC);

      if (classeIData !== null) {
          setRegistrosClasseI((classeIData || []).map((r: any) => {
              const calculations = calculateClasseICalculations(r.efetivo, r.dias_operacao, r.nr_ref_int || 0, Number(r.valor_qs), Number(r.valor_qr));
              return {
                  ...r, diasOperacao: r.dias_operacao, faseAtividade: r.fase_atividade, omQS: r.om_qs, ugQS: r.ug_qs,
                  nrRefInt: r.nr_ref_int, valorQS: Number(r.valor_qs), valorQR: Number(r.valor_qr), quantidadeR2: r.quantidade_r2 || 0,
                  quantidadeR3: r.quantidade_r3 || 0, totalQS: Number(r.total_qs), totalQR: Number(r.total_qr),
                  totalGeral: Number(r.total_geral), complementoQS: Number(r.complemento_qs), etapaQS: Number(r.etapa_qs),
                  complementoQR: Number(r.complemento_qr), etapaQR: Number(r.etapa_qr), memoriaQSCustomizada: r.memoria_calculo_qs_customizada,
                  memoriaQRCustomizada: r.memoria_calculo_qr_customizada, calculos: calculations,
              } as ClasseIRegistro;
          }));
      }

      if (classeIIData !== null || classeVData !== null || classeVIData !== null || classeVIIData !== null || classeVIIISaudeData !== null || classeVIIIRemontaData !== null || classeIXData !== null) {
          const allClasseItems = [
              ...(classeIIData || []).map((r: any) => ({ ...r, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo || 0 })),
              ...(classeVData || []).map((r: any) => ({ ...r, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo || 0 })),
              ...(classeVIData || []).map((r: any) => ({ ...r, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo || 0 })), 
              ...(classeVIIData || []).map((r: any) => ({ ...r, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo || 0 })), 
              ...(classeVIIISaudeData || []).map((r: any) => ({ ...r, itens_equipamentos: r.itens_saude, categoria: 'Saúde', om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo || 0 })), 
              ...(classeVIIIRemontaData || []).map((r: any) => ({ ...r, itens_remonta: r.itens_remonta, categoria: 'Remonta/Veterinária', animal_tipo: r.animal_tipo, quantidade_animais: r.quantidade_animais, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo || 0 })), 
              ...(classeIXData || []).map((r: any) => ({ ...r, itens_equipamentos: r.itens_motomecanizacao, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo || 0 })), 
          ];
          setRegistrosClasseII(allClasseItems as ClasseIIRegistro[]);
      }

      if (classeIIIData !== null) {
          setRegistrosClasseIII((classeIIIData || []).map((r: any) => ({
              ...r, itens_equipamentos: (r.itens_equipamentos as any as ItemClasseIII[] | null) || null, 
          })) as ClasseIIIRegistro[]);
      }

      if (diariaData !== null) {
          setRegistrosDiaria((diariaData || []).map((r: any) => ({
              ...r, destino: r.destino as DestinoDiaria, quantidades_por_posto: r.quantidades_por_posto as QuantidadesPorPosto,
              valor_nd_15: Number(r.valor_nd_15 || 0), valor_nd_30: Number(r.valor_nd_30 || 0), valor_taxa_embarque: Number(r.valor_taxa_embarque || 0),
              valor_total: Number(r.valor_total || 0), is_aereo: r.is_aereo || false,
          })) as DiariaRegistro[]);
      }

      if (verbaOperacionalData !== null) {
          const allVerbaRecords = (verbaOperacionalData || []).map((r: any) => ({
              ...r, valor_total_solicitado: Number(r.valor_total_solicitado || 0), valor_nd_30: Number(r.valor_nd_30 || 0),
              valor_nd_39: Number(r.valor_nd_39 || 0), dias_operacao: r.dias_operacao || 0, quantidade_equipes: r.quantidade_equipes || 0,
              objeto_aquisicao: r.objeto_aquisicao || null, objeto_contratacao: r.objeto_contratacao || null,
              proposito: r.proposito || null, finalidade: r.finalidade || null, local: r.local || null, tarefa: r.tarefa || null,
          })) as VerbaOperacionalRegistro[];
          setRegistrosVerbaOperacional(allVerbaRecords.filter(r => r.detalhamento !== 'Suprimento de Fundos'));
          setRegistrosSuprimentoFundos(allVerbaRecords.filter(r => r.detalhamento === 'Suprimento de Fundos'));
      }

      if (passagemData !== null) {
          setRegistrosPassagem((passagemData || []).map((r: any) => ({
              ...r, valor_unitario: Number(r.valor_unitario || 0), valor_total: Number(r.valor_total || 0),
              valor_nd_33: Number(r.valor_nd_33 || 0), quantidade_passagens: r.quantidade_passagens || 0,
              is_ida_volta: r.is_ida_volta || false, efetivo: r.efetivo || 0,
          })) as PassagemRegistro[]);
      }

      if (concessionariaData !== null) {
          setRegistrosConcessionaria((concessionariaData || []).map((r: any) => ({
              ...r, valor_unitario: Number(r.valor_unitario || 0), consumo_pessoa_dia: Number(r.consumo_pessoa_dia || 0),
              valor_total: Number(r.valor_total || 0), valor_nd_39: Number(r.valor_nd_39 || 0), dias_operacao: r.dias_operacao || 0,
              efetivo: r.efetivo || 0, nome_concessionaria: '', unidade_custo: '', fonte_consumo: null, fonte_custo: null,
          })) as ConcessionariaRegistro[]);
      }

      if (materialConsumoData !== null) {
          setRegistrosMaterialConsumo((materialConsumoData || []).map((r: any) => ({
              ...r, valor_total: Number(r.valor_total || 0), valor_nd_30: Number(r.valor_nd_30 || 0),
              valor_nd_39: Number(r.valor_nd_39 || 0), dias_operacao: r.dias_operacao || 0, efetivo: r.efetivo || 0,
          })) as MaterialConsumoRegistro[]);
      }

      if (complementoAlimentacaoData !== null) {
          setRegistrosComplementoAlimentacao((complementoAlimentacaoData || []).map((r: any) => ({
              ...r, valor_total: Number(r.valor_total || 0), valor_nd_30: Number(r.valor_nd_30 || 0),
              valor_nd_39: Number(r.valor_nd_39 || 0), dias_operacao: r.dias_operacao || 0, efetivo: r.efetivo || 0,
              itens_aquisicao: (r.itens_aquisicao as any) || []
          })) as any);
      }

      if (servicosTerceirosData !== null) {
          setRegistrosServicosTerceiros((servicosTerceirosData || []).map((r: any) => ({
              ...r, valor_total: Number(r.valor_total || 0), valor_nd_30: Number(r.valor_nd_30 || 0),
              valor_nd_39: Number(r.valor_nd_39 || 0), dias_operacao: r.dias_operacao || 0, efetivo: r.efetivo || 0,
          })) as ServicoTerceiroRegistro[]);
      }

      if (materialPermanenteData !== null) {
          setRegistrosMaterialPermanente((materialPermanenteData || []).map((r: any) => ({
              ...r, valor_total: Number(r.valor_total || 0), valor_nd_52: Number(r.valor_nd_52 || 0),
              dias_operacao: r.dias_operacao || 0, efetivo: r.efetivo || 0,
          })) as MaterialPermanenteRegistro[]);
      }

      if (horasVooData !== null) {
          setRegistrosHorasVoo((horasVooData || []).map((r: any) => ({
              ...r, quantidade_hv: Number(r.quantidade_hv || 0), valor_nd_30: Number(r.valor_nd_30 || 0),
              valor_nd_39: Number(r.valor_nd_39 || 0), valor_total: Number(r.valor_total || 0), dias_operacao: r.dias_operacao || 0,
          })) as HorasVooRegistro[]);
      }

      if (dorData !== null) {
          setRegistrosDOR(dorData || []);
          if (dorData && (dorData as any[]).length > 0) {
              setSelectedDorId((prev) => prev ? prev : (dorData as any[])[0].id);
          }
      }

      // Marca que este relatório específico já foi completamente descarregado
      setFetchedReports(prev => new Set(prev).add(selectedReport));

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Não foi possível carregar os dados do relatório.");
    } finally {
      setLoading(false);
    }
  }, [ptrabId, selectedReport, fetchedReports, ptrabData, navigate, ghost]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const gruposPorOM = useMemo(() => {
    const grupos: Record<string, GrupoOM> = {};
    const initializeGroup = (name: string) => {
        if (!grupos[name]) {
            grupos[name] = { 
                linhasQS: [], linhasQR: [], linhasClasseII: [], linhasClasseV: [],
                linhasClasseVI: [], linhasClasseVII: [], linhasClasseVIII: [], linhasClasseIX: [],
                linhasClasseIII: [], linhasConcessionaria: [] 
            };
        }
    };

    registrosClasseI.filter(r => r.categoria === 'RACAO_QUENTE').forEach((registro) => {
        initializeGroup(registro.omQS || registro.organizacao);
        grupos[registro.omQS || registro.organizacao].linhasQS.push({ 
            registro, 
            tipo: 'QS',
            valor_nd_30: registro.totalQS,
            valor_nd_39: 0,
        });
        
        initializeGroup(registro.organizacao);
        grupos[registro.organizacao].linhasQR.push({ 
            registro, 
            tipo: 'QR',
            valor_nd_30: registro.totalQR,
            valor_nd_30: registro.totalQR,
            valor_nd_39: 0,
        });
    });
    
    registrosClasseII.forEach((registro) => {
        initializeGroup(registro.organizacao);
        const omGroup = grupos[registro.organizacao];
        
        const linha = { 
            registro,
            valor_nd_30: registro.valor_nd_30,
            valor_nd_39: registro.valor_nd_39,
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

    registrosClasseIII.forEach((registro) => {
        const isCombustivel = registro.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';
        const isLubrificante = registro.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
        
        if (isCombustivel || isLubrificante) {
            
            let omDestinoRecurso: string;
            if (isCombustivel) {
                omDestinoRecurso = registro.om_detentora || registro.organizacao;
            } else {
                omDestinoRecurso = registro.organizacao;
            }
            
            initializeGroup(omDestinoRecurso);
            
            const itens = registro.itens_equipamentos || [];
            
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
                    const itemWithInputs: ItemClasseIII = {
                        ...item,
                        preco_lubrificante_input: String(registro.preco_lubrificante || 0), 
                        consumo_lubrificante_input: String(registro.consumo_lubrificante_litro || 0),
                    };
                    const totals = calculateItemTotals(itemWithInputs, refLPC, registro.dias_operacao);
                    if (isCombustivel) {
                        totalLitrosLinha += totals.totalLitros;
                        valorTotalLinha += totals.valorCombustivel;
                        precoLitroLinha = totals.precoLitro; 
                        
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
                
                const omFornecedora = registro.om_detentora || '';
                const ugFornecedora = registro.ug_detentora || '';
                
                const omDestinoLubrificante = registro.organizacao; 
                const ugDestinoLubrificante = registro.ug;
                
                const granularItem: GranularDisplayItem = {
                    id: `${registro.id}-${categoriaKey}-${tipoSuprimento}`,
                    om_destino: registro.organizacao,
                    ug_destino: registro.ug,
                    categoria: categoriaKey as any,
                    suprimento_tipo: tipoSuprimento,
                    valor_total: valorTotalLinha,
                    total_litros: totalLitrosLinha,
                    preco_litro: precoLitroLinha,
                    dias_operacao: registro.dias_operacao,
                    fase_atividade: registro.fase_atividade || '',
                    valor_nd_30: isCombustivel ? valorTotalLinha : (isLubrificante ? valorTotalLinha : 0),
                    valor_nd_39: 0,
                    original_registro: registro,
                    detailed_items: itensGrupo.map(item => ({
                        ...item,
                        preco_lubrificante_input: String(registro.preco_lubrificante || 0),
                        consumo_lubrificante_input: String(registro.consumo_lubrificante_litro || 0),
                    })),
                };
                
                const itemComMemoria = itensGrupo.find(i => !!i.memoria_customizada) || itensGrupo[0];
                if (itemComMemoria && itemComMemoria.memoria_customizada && itemComMemoria.memoria_customizada.trim().length > 0) {
                    memoriaCalculo = itemComMemoria.memoria_customizada;
                } else {
                    memoriaCalculo = generateClasseIIIGranularUtility(
                        granularItem as any, 
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
        const aPriority = getOMPriority(a, rmName);
        const bPriority = getOMPriority(b, rmName);
        if (aPriority !== bPriority) {
            return aPriority - bPriority;
        }
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
  
  const gruposOperacionaisPorOM = useMemo(() => {
    const grupos: Record<string, GrupoOMOperacional> = {};
    const initializeGroup = (name: string) => {
        if (!grupos[name]) {
            grupos[name] = {
                diarias: [],
                verbaOperacional: [],
                suprimentoFundos: [],
                passagens: [],
                concessionarias: [],
                materialConsumo: [],
                complementoAlimentacao: [],
                servicosTerceiros: []
            };
        }
    };

    const getCreditRecipientOM = (record: any, isDetentoraBased: boolean) => {
        if (isDetentoraBased) {
            return record.om_detentora || record.organizacao;
        }
        return record.organizacao;
    };

    registrosDiaria.forEach(r => {
        const om = getCreditRecipientOM(r, false);
        initializeGroup(om);
        grupos[om].diarias.push(r);
    });

    registrosVerbaOperacional.forEach(r => {
        const om = getCreditRecipientOM(r, true);
        initializeGroup(om);
        grupos[om].verbaOperacional.push(r);
    });

    registrosSuprimentoFundos.forEach(r => {
        const om = getCreditRecipientOM(r, false);
        initializeGroup(om);
        grupos[om].suprimentoFundos.push(r);
    });

    registrosPassagem.forEach(r => {
        const om = getCreditRecipientOM(r, true);
        initializeGroup(om);
        grupos[om].passagens.push(r);
    });

    registrosConcessionaria.forEach(r => {
        const om = getCreditRecipientOM(r, true);
        initializeGroup(om);
        grupos[om].concessionarias.push(r);
    });

    registrosMaterialConsumo.forEach(r => {
        const om = getCreditRecipientOM(r, true);
        initializeGroup(om);
        grupos[om].materialConsumo.push(r);
    });

    registrosComplementoAlimentacao.forEach(r => {
        if (r.categoria_complemento === 'genero') {
            // QR vai para a OM Solicitante
            const omQR = r.organizacao;
            initializeGroup(omQR);
            grupos[omQR].complementoAlimentacao.push({ registro: r, subType: 'QR' });

            // QS vai para a RM
            const omQS = r.om_qs || r.organizacao;
            initializeGroup(omQS);
            grupos[omQS].complementoAlimentacao.push({ registro: r, subType: 'QS' });
        } else {
            // Água e Lanche vão para a OM de destino (detentora)
            const om = getCreditRecipientOM(r, true);
            initializeGroup(om);
            grupos[om].complementoAlimentacao.push({ registro: r });
        }
    });

    registrosServicosTerceiros.forEach(r => {
        const om = getCreditRecipientOM(r, true);
        initializeGroup(om);
        grupos[om].servicosTerceiros.push(r);
    });

    return grupos;
  }, [registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, registrosConcessionaria, registrosMaterialConsumo, registrosComplementoAlimentacao, registrosServicosTerceiros]);

  const gruposHorasVooPorOM = useMemo(() => {
    const grupos: Record<string, HorasVooRegistro[]> = {};
    const initializeGroup = (name: string) => {
        if (!grupos[name]) {
            grupos[name] = [];
        }
    };

    registrosHorasVoo.forEach(r => {
        const om = r.om_detentora || r.organizacao;
        initializeGroup(om);
        grupos[om].push(r);
    });

    return grupos;
  }, [registrosHorasVoo]);

  const omsHorasVooOrdenadas = useMemo(() => {
    const oms = Object.keys(gruposHorasVooPorOM);
    const rmName = nomeRM;
    
    return oms.sort((a, b) => {
        const aPriority = getOMPriority(a, rmName);
        const bPriority = getOMPriority(b, rmName);
        if (aPriority !== bPriority) {
            return aPriority - bPriority;
        }
        return a.localeCompare(b);
    });
  }, [gruposHorasVooPorOM, nomeRM]);

  const omsOperacionaisOrdenadas = useMemo(() => {
    const oms = Object.keys(gruposOperacionaisPorOM);
    const rmName = nomeRM;
    
    return oms.sort((a, b) => {
        const aPriority = getOMPriority(a, rmName);
        const bPriority = getOMPriority(b, rmName);
        if (aPriority !== bPriority) {
            return aPriority - bPriority;
        }
        return a.localeCompare(b);
    });
  }, [gruposOperacionaisPorOM, nomeRM]);
  
  const hasDataForReport = useMemo(() => {
    switch (selectedReport) {
      case 'logistico':
        const hasClasseI_QSQR = registrosClasseI.some(r => r.categoria === 'RACAO_QUENTE');
        const hasOutrasClasses = registrosClasseII.length > 0 || 
                                 registrosClasseIII.length > 0;
        return hasClasseI_QSQR || hasOutrasClasses;

      case 'racao_operacional':
        return registrosClasseI.some(r => r.categoria === 'RACAO_OPERACIONAL');

      case 'operacional':
        return registrosDiaria.length > 0 || 
               registrosVerbaOperacional.length > 0 || 
               registrosSuprimentoFundos.length > 0 || 
               registrosPassagem.length > 0 ||
               registrosConcessionaria.length > 0 ||
               registrosMaterialConsumo.length > 0 ||
               registrosComplementoAlimentacao.length > 0 ||
               registrosServicosTerceiros.length > 0; 

      case 'material_permanente':
        return registrosMaterialPermanente.length > 0; 
      case 'hora_voo':
        return registrosHorasVoo.length > 0;
      case 'dor':
        return registrosDOR.length > 0; 
      default:
        return false;
    }
  }, [selectedReport, registrosClasseI, registrosClasseII, registrosClasseIII, registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, registrosConcessionaria, registrosMaterialConsumo, registrosComplementoAlimentacao, registrosServicosTerceiros, registrosMaterialPermanente, registrosHorasVoo, registrosDOR]);


  const renderReport = () => {
    if (!ptrabData) return null;

    const fileSuffix = currentReportOption.fileSuffix;
    const reportName = currentReportOption.label;

    if (!hasDataForReport) {
        return (
            <NoDataFallback 
                reportName={reportName}
                message={`Não há dados de classes ou itens registrados neste P Trab para gerar o relatório de ${reportName}.`}
            />
        );
    }

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
                omsOrdenadas={omsOperacionaisOrdenadas}
                gruposPorOM={gruposOperacionaisPorOM}
                registrosDiaria={registrosDiaria}
                registrosVerbaOperacional={registrosVerbaOperacional}
                registrosSuprimentoFundos={registrosSuprimentoFundos}
                registrosPassagem={registrosPassagem}
                registrosConcessionaria={registrosConcessionaria}
                registrosMaterialConsumo={registrosMaterialConsumo} 
                registrosComplementoAlimentacao={registrosComplementoAlimentacao}
                registrosServicosTerceiros={registrosServicosTerceiros}
                diretrizesOperacionais={diretrizesOperacionais}
                diretrizesPassagens={diretrizesPassagens} 
                fileSuffix={fileSuffix}
                generateDiariaMemoriaCalculo={generateDiariaMemoriaCalculoUnificada}
                generateVerbaOperacionalMemoriaCalculo={generateVerbaOperacionalMemoriaCalculada}
                generateSuprimentoFundosMemoriaCalculo={generateSuprimentoFundosMemoriaCalculada}
                generatePassagemMemoriaCalculo={generatePassagemMemoriaCalculada} 
                generateConcessionariaMemoriaCalculo={generateConcessionariaMemoriaCalculada}
                generateMaterialConsumoMemoriaCalculo={generateMaterialConsumoMemoriaCalculada} 
                generateComplementoMemoriaCalculo={generateComplementoMemoriaCalculada}
                generateServicoMemoriaCalculo={generateServicoMemoriaCalculada}
            />
        );
      case 'material_permanente':
        return (
          <PTrabMaterialPermanenteReport
            ptrabData={ptrabData}
            registrosMaterialPermanente={registrosMaterialPermanente}
            fileSuffix={fileSuffix}
          />
        );
      case 'hora_voo':
        return (
            <PTrabHorasVooReport
                ptrabData={ptrabData}
                omsOrdenadas={omsHorasVooOrdenadas}
                gruposPorOM={gruposHorasVooPorOM}
                fileSuffix={fileSuffix}
            />
        );
      case 'dor':
        const selectedDor = registrosDOR.find(d => d.id === selectedDorId) || registrosDOR[0];
        
        // Seletor de Documento para ser passado como prop
        const dorSelector = registrosDOR.length > 1 ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold whitespace-nowrap">Selecionar Documento:</span>
            <Select value={selectedDorId || ''} onValueChange={setSelectedDorId}>
              <SelectTrigger className="w-[300px] bg-white">
                <SelectValue placeholder="Escolha o DOR" />
              </SelectTrigger>
              <SelectContent>
                {registrosDOR.map(dor => (
                  <SelectItem key={dor.id} value={dor.id}>
                    DOR Nr {dor.numero_dor || 'S/N'} - {new Date(dor.created_at).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null;

        return (
          <PTrabDORReport 
            ptrabData={ptrabData} 
            dorData={selectedDor} 
            selector={dorSelector}
          />
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
    <div className={cn("min-h-screen bg-background tour-report-manager-root", ghost && "pt-10")}>
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
              <SelectTrigger className="w-[320px] tour-report-selector">
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

      <div className="container max-w-7xl mx-auto py-4 px-4 tour-export-buttons">
        {renderReport()}
      </div>
    </div>
  );
};

export default PTrabReportManager;