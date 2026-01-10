import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA, formatCodug } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, Package, Utensils, Briefcase, HardHat, Plane, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PTrabLogisticoReport from "@/components/reports/PTrabLogisticoReport";
import PTrabRacaoOperacionalReport from "@/components/reports/PTrabRacaoOperacionalReport";
import PTrabOperacionalReport from "@/components/reports/PTrabOperacionalReport"; // NOVO: Importar o relatório operacional
import { 
  generateRacaoQuenteMemoriaCalculo, 
  generateRacaoOperacionalMemoriaCalculo,
  calculateClasseICalculations,
  ClasseIRegistro as ClasseIRegistroType,
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
import { RefLPC } from "@/types/refLPC";
import { fetchDiretrizesOperacionais } from "@/lib/ptrabUtils";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { Tables } from "@/integrations/supabase/types"; // Importar Tables

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

// Usando o tipo importado para garantir consistência
export type ClasseIRegistro = ClasseIRegistroType;

// NOVO TIPO: DiariaRegistro
export interface DiariaRegistro {
  id: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  destino: DestinoDiaria;
  nr_viagens: number;
  local_atividade: string;
  quantidades_por_posto: QuantidadesPorPosto;
  valor_total: number;
  valor_nd_15: number;
  valor_nd_30: number;
  valor_taxa_embarque: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade: string;
  is_aereo: boolean;
}

export interface ItemClasseIII {
  item: string; // nome_equipamento
  categoria: 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
  consumo_fixo: number; // L/h or km/L
  tipo_combustivel_fixo: 'GASOLINA' | 'DIESEL'; // GASOLINA or DIESEL
  unidade_fixa: 'L/h' | 'km/L';
  quantidade: number;
  horas_dia: number;
  distancia_percorrida: number;
  quantidade_deslocamentos: number;
  dias_utilizados: number;
  // Lubricant fields (only for GERADOR, EMBARCACAO)
  consumo_lubrificante_litro: number; // L/100h or L/h
  preco_lubrificante: number; // R$/L
  memoria_customizada?: string | null; // NOVO CAMPO
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
  animal_tipo?: 'Equino' | 'Canino' | null;
  quantidade_animais?: number;
  itens_remonta?: any; // Usado para Classe VIII Remonta
  itens_saude?: any; // Usado para Classe VIII Saúde
  itens_motomecanizacao?: ItemClasseIX[];
  om_detentora?: string | null;
  ug_detentora?: string | null;
  efetivo?: number;
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
  itens_equipamentos?: ItemClasseIII[]; // Tipo corrigido
  fase_atividade?: string; // Adicionado para Classe III
  consumo_lubrificante_litro?: number; // Adicionado para Classe III
  preco_lubrificante?: number; // Adicionado para Classe III
  valor_nd_30: number; // Adicionado para Classe III
  valor_nd_39: number; // Adicionado para Classe III
  om_detentora?: string | null; // Adicionado para Classe III (OM Destino Recurso)
  ug_detentora?: string | null; // Adicionado para Classe III (UG Destino Recurso)
}

// NOVO TIPO: Linha desagregada de Classe III para o relatório logístico
export interface LinhaClasseIII {
  registro: ClasseIIIRegistro;
  categoria_equipamento: 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO' | 'LUBRIFICANTE';
  tipo_suprimento: 'COMBUSTIVEL_GASOLINA' | 'COMBUSTIVEL_DIESEL' | 'LUBRIFICANTE';
  valor_total_linha: number;
  total_litros_linha: number;
  preco_litro_linha: number;
  memoria_calculo: string;
}

// NOVO TIPO: Estrutura granular para geração de memória da Classe III
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

export interface LinhaTabela {
  registro: ClasseIRegistro;
  valor_nd_30: number; // Adicionado para consistência
  valor_nd_39: number; // Adicionado para consistência
  tipo: 'QS' | 'QR';
}

export interface LinhaClasseII {
  registro: ClasseIIRegistro;
  valor_nd_30: number; // Adicionado para consistência
  valor_nd_39: number; // Adicionado para consistência
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
  linhasClasseIII: LinhaClasseIII[]; // Inicializa a nova lista
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
            if (registro.memoria_calculo_op_customizada && registro.memoria_calculo_op_customizada.trim().length > 0) {
                return registro.memoria_calculo_op_customizada;
            }
            
            return generateRacaoOperacionalMemoriaCalculo({
                id: registro.id,
                organizacao: registro.organizacao,
                ug: registro.ug,
                diasOperacao: registro.dias_operacao,
                faseAtividade: registro.fase_atividade,
                efetivo: registro.efetivo,
                quantidadeR2: registro.quantidade_r2,
                quantidadeR3: registro.quantidade_r3,
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
            diasOperacao: registro.dias_operacao,
            faseAtividade: registro.fase_atividade,
            omQS: registro.om_qs,
            ugQS: registro.ug_qs,
            efetivo: registro.efetivo,
            nrRefInt: registro.nr_ref_int,
            valorQS: registro.valor_qs,
            valorQR: registro.valor_qr,
            calculos: {
                totalQS: registro.total_qs,
                totalQR: registro.total_qr,
                nrCiclos: calculateClasseICalculations(registro.efetivo, registro.dias_operacao, registro.nr_ref_int || 0, registro.valor_qs || 0, registro.valor_qr || 0).nrCiclos,
                diasEtapaPaga: 0,
                diasEtapaSolicitada: calculateClasseICalculations(registro.efetivo, registro.dias_operacao, registro.nr_ref_int || 0, registro.valor_qs || 0, registro.valor_qr || 0).diasEtapaSolicitada,
                totalEtapas: 0,
                complementoQS: registro.complemento_qs,
                etapaQS: registro.etapa_qs,
                complementoQR: registro.complemento_qr,
                etapaQR: registro.etapa_qr,
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
            diasOperacao: registro.dias_operacao,
            faseAtividade: registro.fase_atividade,
            omQS: registro.om_qs,
            ugQS: registro.ug_qs,
            efetivo: registro.efetivo,
            nrRefInt: registro.nr_ref_int,
            valorQS: registro.valor_qs,
            valorQR: registro.valor_qr,
            calculos: {
                totalQS: registro.total_qs,
                totalQR: registro.total_qr,
                nrCiclos: calculateClasseICalculations(registro.efetivo, registro.dias_operacao, registro.nr_ref_int || 0, registro.valor_qs || 0, registro.valor_qr || 0).nrCiclos,
                diasEtapaPaga: 0,
                diasEtapaSolicitada: calculateClasseICalculations(registro.efetivo, registro.dias_operacao, registro.nr_ref_int || 0, registro.valor_qs || 0, registro.valor_qr || 0).diasEtapaSolicitada,
                totalEtapas: 0,
                complementoQS: registro.complemento_qs,
                etapaQS: registro.etapa_qs,
                complementoQR: registro.complemento_qr,
                etapaQR: registro.etapa_qr,
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
            registro.itens_equipamentos,
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
            registro.categoria,
            registro.itens_equipamentos,
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
            registro.categoria,
            registro.itens_equipamentos,
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
            registro.categoria,
            registro.itens_equipamentos,
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
            itens,
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

/**
 * Função para gerar a memória de cálculo da Classe III (Combustível/Lubrificante)
 * no nível granular (o mesmo nível de detalhe da edição do usuário).
 */
export const generateClasseIIIMemoriaCalculo = (registro: ClasseIIIRegistro, refLPC: RefLPC | null): string => {
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
        return registro.detalhamento_customizado;
    }
    
    const itens = registro.itens_equipamentos || [];
    
    if (registro.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO') {
        
        let finalMemoria = "";
        
        const gruposPorCombustivel = itens.reduce((grupos, item) => {
            const tipo = item.tipo_combustivel_fixo;
            if (!grupos[tipo]) grupos[tipo] = [];
            grupos[tipo].push(item);
            return grupos;
        }, {} as Record<'GASOLINA' | 'DIESEL', ItemClasseIII[]>);
        
        Object.entries(gruposPorCombustivel).forEach(([tipoCombustivel, itensGrupo]) => {
            itensGrupo.forEach(item => {
                if (item.memoria_customizada && item.memoria_customizada.trim().length > 0) {
                    finalMemoria += item.memoria_customizada + "\n\n";
                    return;
                }
                
                const suprimento_tipo = item.tipo_combustivel_fixo === 'GASOLINA' ? 'COMBUSTIVEL_GASOLINA' : 'COMBUSTIVEL_DIESEL';
                
                const granularItem: GranularDisplayItem = {
                    id: `${registro.id}-${item.item}-${suprimento_tipo}`,
                    om_destino: registro.organizacao,
                    ug_destino: registro.ug,
                    categoria: item.categoria,
                    suprimento_tipo: suprimento_tipo,
                    valor_total: 0,
                    total_litros: 0,
                    preco_litro: registro.preco_litro,
                    dias_operacao: registro.dias_operacao,
                    fase_atividade: registro.fase_atividade || '',
                    valor_nd_30: registro.valor_nd_30,
                    valor_nd_39: registro.valor_nd_39,
                    original_registro: registro,
                    detailed_items: [item],
                };
                
                const rmFornecimento = registro.om_detentora || '';
                const codugRmFornecimento = registro.ug_detentora || '';
                
                const totals = calculateItemTotals(item, refLPC, registro.dias_operacao);
                granularItem.valor_total = totals.valorCombustivel;
                granularItem.total_litros = totals.totalLitros;
                
                finalMemoria += generateClasseIIIGranularUtility(
                    granularItem, 
                    refLPC, 
                    rmFornecimento, 
                    codugRmFornecimento
                ) + "\n\n";
            });
        });
        
        return finalMemoria.trim();
        
    } else if (registro.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO') {
        
        const gruposPorCategoria = itens.reduce((grupos, item) => {
            const categoria = item.categoria;
            if (!grupos[categoria]) grupos[categoria] = [];
            grupos[categoria].push(item);
            return grupos;
        }, {} as Record<'GERADOR' | 'EMBARCACAO', ItemClasseIII[]>);
        
        let finalMemoria = "";
        
        Object.entries(gruposPorCategoria).forEach(([categoria, itensGrupo]) => {
            const itemComMemoria = itensGrupo.find(i => !!i.memoria_customizada) || itensGrupo[0];
            if (itemComMemoria && itemComMemoria.memoria_customizada && itemComMemoria.memoria_customizada.trim().length > 0) {
                finalMemoria += itemComMemoria.memoria_customizada + "\n\n";
                return;
            }
            
            const omDestinoLubrificante = registro.om_detentora || '';
            const ugDestinoLubrificante = registro.ug_detentora || '';
            
            const granularItem: GranularDisplayItem = {
                id: `${registro.id}-${categoria}-LUBRIFICANTE`,
                om_destino: registro.organizacao,
                ug_destino: registro.ug,
                categoria: categoria as any,
                suprimento_tipo: 'LUBRIFICANTE',
                valor_total: registro.valor_total,
                total_litros: registro.total_litros,
                preco_litro: 0,
                dias_operacao: registro.dias_operacao,
                fase_atividade: registro.fase_atividade || '',
                valor_nd_30: registro.valor_nd_30,
                valor_nd_39: registro.valor_nd_39,
                original_registro: registro,
                detailed_items: itensGrupo,
            };
            
            finalMemoria += generateClasseIIIGranularUtility(
                granularItem, 
                refLPC, 
                omDestinoLubrificante, 
                ugDestinoLubrificante
            ) + "\n\n";
        });
        
        return finalMemoria.trim();
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
// COMPONENTE PTrabLogisticoReport
// =================================================================

const PTrabLogisticoReport: React.FC<PTrabLogisticoReportProps> = ({
  ptrabData,
  registrosClasseI,
  registrosClasseII,
  registrosClasseIII,
  nomeRM,
  omsOrdenadas,
  gruposPorOM,
  calcularTotaisPorOM,
  fileSuffix,
  generateClasseIMemoriaCalculo,
  generateClasseIIMemoriaCalculo,
  generateClasseVMemoriaCalculo,
  generateClasseVIMemoriaCalculo,
  generateClasseVIIMemoriaCalculo,
  generateClasseVIIIMemoriaCalculo,
  generateClasseIIIMemoriaCalculo,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  
  // Calcula os totais gerais de cada ND
  const totaisND = useMemo(() => {
    const totals = {
      nd30: 0,
      nd39: 0,
      nd33: 0,
      nd00: 0,
      totalGND3: 0,
    };

    omsOrdenadas.forEach(omKey => {
      const grupo = gruposPorOM[omKey];
      const omTotals = calcularTotaisPorOM(grupo, omKey);
      
      // Classe I (QS/QR) e Lubrificante já estão em total_33_90_30
      totals.nd30 += omTotals.total_33_90_30 + omTotals.valorDiesel + omTotals.valorGasolina; 
      
      // Classes II, V, VI, VII, VIII, IX (Serviço)
      totals.nd39 += omTotals.total_33_90_39;
      
      // O total GND3 é a soma de todos os totais calculados por OM
      totals.totalGND3 += omTotals.total_gnd3;
    });
    
    // Ajuste final: ND 30 deve ser a soma de todos os 33.90.30 (incluindo combustíveis e lubrificantes)
    // O cálculo dentro de calcularTotaisPorOM já faz isso, mas precisamos garantir que o total geral reflita a soma correta.
    
    // Recalculando ND30 e ND39 de forma mais granular para o total geral:
    let totalND30 = 0;
    let totalND39 = 0;
    
    // 1. Classe I (QS/QR)
    totalND30 += registrosClasseI.filter(r => r.categoria === 'RACAO_QUENTE').reduce((sum, r) => sum + r.total_qs + r.total_qr, 0);
    
    // 2. Classes II, V, VI, VII, VIII, IX
    registrosClasseII.forEach(r => {
        totalND30 += r.valor_nd_30;
        totalND39 += r.valor_nd_39;
    });
    
    // 3. Classe III (Combustível e Lubrificante)
    registrosClasseIII.forEach(r => {
        totalND30 += r.valor_nd_30; // Combustível e Lubrificante são ND 30
        totalND39 += r.valor_nd_39; // Deve ser 0, mas incluído por segurança
    });
    
    // 4. Diárias (ND 30) - Se houver
    // NOTE: Diárias (ND 15) são Operacionais. Diárias (ND 30) são Passagens Aéreas.
    // Como este é o relatório LOGÍSTICO, incluímos apenas o que é ND 30.
    // O PTrabReportManager não está passando registrosDiaria para cá, mas o cálculo de totais já inclui o ND 30 das diárias.
    // Vamos confiar no cálculo de totais do PTrabCostSummary (que é o que o PTrabManager usa para o total geral)
    
    // Para o relatório logístico, o total GND3 é a soma de todos os 33.90.30 e 33.90.39
    const totalGND3 = totalND30 + totalND39;

    return {
      nd30: totalND30,
      nd39: totalND39,
      nd33: 0,
      nd00: 0,
      totalGND3: totalGND3,
    };
  }, [omsOrdenadas, gruposPorOM, calcularTotaisPorOM, registrosClasseI, registrosClasseII, registrosClasseIII]);
  
  // Função para gerar o nome do arquivo
  const generateFileName = (reportType: 'PDF' | 'Excel') => {
    const dataAtz = formatDateDDMMMAA(ptrabData.updated_at);
    const numeroPTrab = ptrabData.numero_ptrab.replace(/\//g, '-'); 
    
    const isMinuta = ptrabData.numero_ptrab.startsWith("Minuta");
    const currentYear = new Date(ptrabData.periodo_inicio).getFullYear();
    
    let nomeBase = `P Trab Nr ${numeroPTrab}`;
    
    if (isMinuta) {
        nomeBase += ` - ${currentYear} - ${ptrabData.nome_om}`;
    }
    
    nomeBase += ` - ${ptrabData.nome_operacao}`;
    nomeBase += ` - Atz ${dataAtz} - ${fileSuffix}`;
    
    return `${nomeBase}.${reportType === 'PDF' ? 'pdf' : 'xlsx'}`;
  };

  // Função para exportar PDF (Download)
  const exportPDF = useCallback(() => {
    if (!contentRef.current) return;

    const pdfToast = toast({
      title: "Gerando PDF...",
      description: "Aguarde enquanto o relatório é processado.",
    });

    html2canvas(contentRef.current, {
      scale: 3, 
      useCORS: true,
      allowTaint: true,
    }).then((canvas) => {
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = 297; 
      const pdfHeight = 210; 
      
      const margin = 5;
      const contentWidth = pdfWidth - 2 * margin;
      const contentHeight = pdfHeight - 2 * margin;

      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin; 

      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= contentHeight;

      while (heightLeft > -1) { 
        position = heightLeft - imgHeight + margin; 
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= contentHeight;
      }

      pdf.save(generateFileName('PDF'));
      pdfToast.dismiss();
      toast({
        title: "PDF Exportado!",
        description: "O P Trab Logístico foi salvo com sucesso.",
        duration: 3000,
      });
    }).catch(error => {
      console.error("Erro ao gerar PDF:", error);
      pdfToast.dismiss();
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    });
  }, [ptrabData, totaisND, fileSuffix, diasOperacao, gruposPorOM, omsOrdenadas, calcularTotaisPorOM, generateClasseIMemoriaCalculo, generateClasseIIMemoriaCalculo, generateClasseIIIMemoriaCalculo, toast]);

  // Função para Imprimir (Abre a caixa de diálogo de impressão)
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const exportExcel = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('P Trab Logístico');

    // --- Definição de Estilos e Alinhamentos ---
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const centerTopAlignment = { horizontal: 'center' as const, vertical: 'top' as const, wrapText: true };
    const leftMiddleAlignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true }; 
    
    const cellBorder = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    };
    
    const baseFontStyle = { name: 'Arial', size: 8 };
    const headerFontStyle = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF000000' } };
    const titleFontStyle = { name: 'Arial', size: 11, bold: true };
    const corHeader = 'FFD9D9D9'; // Cinza claro para o cabeçalho da tabela
    const corSubtotalOM = 'FFD9D9D9'; // Cinza para o subtotal OM
    const corGrandTotal = 'FFE8E8E8'; // Cinza claro para o total geral
    const corND = 'FFB4C7E7'; // Azul para as NDs (APENAS NAS LINHAS DE DADOS)
    const corSomaND = 'FFD9D9D9'; // Cinza para a linha de soma por ND
    // -------------------------------------------

    let currentRow = 1;
    
    const addHeaderRow = (text: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = text;
        row.getCell(1).font = titleFontStyle;
        row.getCell(1).alignment = centerMiddleAlignment;
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas
        currentRow++;
    };
    
    addHeaderRow('MINISTÉRIO DA DEFESA');
    addHeaderRow('EXÉRCITO BRASILEIRO');
    addHeaderRow(ptrabData.comando_militar_area.toUpperCase());
    
    const omExtensoRow = worksheet.getRow(currentRow);
    omExtensoRow.getCell(1).value = (ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase();
    omExtensoRow.getCell(1).font = titleFontStyle;
    omExtensoRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas
    currentRow++;
    
    const fullTitleRow = worksheet.getRow(currentRow);
    fullTitleRow.getCell(1).value = `PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
    fullTitleRow.getCell(1).font = titleFontStyle;
    fullTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas
    currentRow++;

    const shortTitleRow = worksheet.getRow(currentRow);
    shortTitleRow.getCell(1).value = 'PLANO DE TRABALHO LOGÍSTICO';
    shortTitleRow.getCell(1).font = { ...titleFontStyle, underline: true };
    shortTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas
    currentRow++;
    
    currentRow++;
    
    const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
    
    const addInfoRow = (label: string, value: string) => {
        const row = worksheet.getRow(currentRow);
        
        row.getCell(1).value = {
          richText: [
            { text: label, font: headerFontStyle },
            { text: ` ${value}`, font: { name: 'Arial', size: 9, bold: false } }
          ]
        };
        
        row.getCell(1).alignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas
        currentRow++;
    };
    
    addInfoRow('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
    addInfoRow('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${diasOperacao}`);
    addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado}`);
    addInfoRow('4. AÇÕES REALIZADAS OU A REALIZAR:', ptrabData.acoes || '');
    
    const despesasRow = worksheet.getRow(currentRow);
    despesasRow.getCell(1).value = '5. DESPESAS LOGÍSTICAS REALIZADAS OU A REALIZAR:';
    despesasRow.getCell(1).font = headerFontStyle;
    currentRow++;
    
    // Cabeçalho da Tabela (9 colunas)
    const headerRow1 = worksheet.getRow(currentRow);
    headerRow1.getCell('A').value = 'DESPESAS';
    headerRow1.getCell('B').value = 'OM (UGE)\nCODUG';
    headerRow1.getCell('C').value = 'NATUREZA DE DESPESA';
    headerRow1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG';
    
    worksheet.mergeCells(`A${currentRow}:A${currentRow+1}`);
    worksheet.mergeCells(`B${currentRow}:B${currentRow+1}`);
    worksheet.mergeCells(`C${currentRow}:H${currentRow}`);
    worksheet.mergeCells(`I${currentRow}:I${currentRow+1}`);
    
    const headerRow2 = worksheet.getRow(currentRow + 1);
    headerRow2.getCell('C').value = '33.90.15';
    headerRow2.getCell('D').value = '33.90.30';
    headerRow2.getCell('E').value = '33.90.33';
    headerRow2.getCell('F').value = '33.90.39';
    headerRow2.getCell('G').value = '33.90.00';
    headerRow2.getCell('H').value = 'GND 3';
    
    worksheet.columns = [
        { width: 25 }, // A: DESPESAS
        { width: 15 }, // B: OM (UGE) CODUG
        { width: 10 }, // C: 33.90.15
        { width: 10 }, // D: 33.90.30
        { width: 10 }, // E: 33.90.33
        { width: 10 }, // F: 33.90.39
        { width: 10 }, // G: 33.90.00
        { width: 10 }, // H: GND 3
        { width: 50 }, // I: DETALHAMENTO
    ];
    
    // Apply styles to header rows
    const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    
    headerCols.forEach(col => {
        const cell1 = headerRow1.getCell(col);
        cell1.style = {
            font: headerFontStyle,
            alignment: centerMiddleAlignment,
            border: cellBorder,
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: corHeader } }
        };
        
        const cell2 = headerRow2.getCell(col);
        cell2.style = {
            font: headerFontStyle,
            alignment: centerMiddleAlignment,
            border: cellBorder,
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: corHeader } }
        };
        
        // NDs específicas
        if (col === 'C') { // 33.90.15 (Diárias) - Deve ser 0 no Logístico
            cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
        } else if (col === 'D' || col === 'F') { // 33.90.30 e 33.90.39
            cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
        }
        
        // Ajuste para as células mescladas
        if (col === 'A' || col === 'B' || col === 'I') {
            cell2.value = '';
            cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corHeader } };
        }
    });
    
    currentRow += 2; // Start data rows after the two header rows

    // Dados da Tabela (Agrupados por OM)
    omsOrdenadas.forEach(omKey => {
        const grupo = gruposPorOM[omKey];
        const omTotals = calcularTotaisPorOM(grupo, omKey);
        const omName = omKey.split(' (')[0];
        const ug = omKey.split(' (')[1].replace(')', '');
        
        // --- 1. CLASSE I (QS/QR) ---
        const linhasClasseI = [...grupo.linhasQS, ...grupo.linhasQR];
        if (linhasClasseI.length > 0) {
            linhasClasseI.forEach(linha => {
                const row = worksheet.getRow(currentRow);
                
                // A: DESPESAS
                row.getCell('A').value = `CLASSE I - ${linha.tipo}`; 
                row.getCell('A').alignment = leftMiddleAlignment; 
                
                // B: OM (UGE) CODUG
                row.getCell('B').value = `${linha.registro.organizacao}\n(${formatCodug(linha.registro.ug)})`;
                row.getCell('B').alignment = centerMiddleAlignment;
                
                // C: 33.90.15 (0)
                row.getCell('C').value = 0;
                row.getCell('C').alignment = centerMiddleAlignment;
                row.getCell('C').numFmt = 'R$ #,##0.00';
                row.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
                
                // D: 33.90.30 (Total QS/QR)
                row.getCell('D').value = linha.registro.total_qs + linha.registro.total_qr;
                row.getCell('D').alignment = centerMiddleAlignment;
                row.getCell('D').numFmt = 'R$ #,##0.00';
                row.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
                
                // E, F, G: Outras NDs (0)
                row.getCell('E').value = 0;
                row.getCell('F').value = 0;
                row.getCell('G').value = 0;
                ['E', 'F', 'G'].forEach(col => {
                    row.getCell(col).alignment = centerMiddleAlignment;
                    row.getCell(col).numFmt = 'R$ #,##0.00';
                    row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
                });
                
                // H: GND 3 (Total da linha)
                row.getCell('H').value = linha.registro.total_qs + linha.registro.total_qr;
                row.getCell('H').alignment = centerMiddleAlignment;
                row.getCell('H').numFmt = 'R$ #,##0.00';
                row.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
                
                // I: DETALHAMENTO
                row.getCell('I').value = generateClasseIMemoriaCalculo(linha.registro, linha.tipo);
                row.getCell('I').alignment = leftTopAlignment;
                row.getCell('I').font = { name: 'Arial', size: 6.5 };
                
                ['A', 'B', 'I'].forEach(col => {
                    row.getCell(col).font = baseFontStyle;
                });
                
                ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
                    row.getCell(col).border = cellBorder;
                });
                currentRow++;
            });
        }
        
        // --- 2. CLASSES II, V, VI, VII, VIII, IX ---
        const todasClasses = [
            ...grupo.linhasClasseII, ...grupo.linhasClasseV, ...grupo.linhasClasseVI, 
            ...grupo.linhasClasseVII, ...grupo.linhasClasseVIII, ...grupo.linhasClasseIX
        ];
        
        if (todasClasses.length > 0) {
            todasClasses.forEach(linha => {
                const row = worksheet.getRow(currentRow);
                
                // A: DESPESAS
                row.getCell('A').value = `CLASSE ${linha.registro.categoria.split(' ')[0]} - ${getClasseIILabel(linha.registro.categoria)}`; 
                row.getCell('A').alignment = leftMiddleAlignment; 
                
                // B: OM (UGE) CODUG
                row.getCell('B').value = `${linha.registro.organizacao}\n(${formatCodug(linha.registro.ug)})`;
                row.getCell('B').alignment = centerMiddleAlignment;
                
                // C: 33.90.15 (0)
                row.getCell('C').value = 0;
                row.getCell('C').alignment = centerMiddleAlignment;
                row.getCell('C').numFmt = 'R$ #,##0.00';
                row.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
                
                // D: 33.90.30 (Material)
                row.getCell('D').value = linha.registro.valor_nd_30;
                row.getCell('D').alignment = centerMiddleAlignment;
                row.getCell('D').numFmt = 'R$ #,##0.00';
                row.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
                
                // E: 33.90.33 (0)
                row.getCell('E').value = 0;
                row.getCell('E').alignment = centerMiddleAlignment;
                row.getCell('E').numFmt = 'R$ #,##0.00';
                row.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
                
                // F: 33.90.39 (Serviço)
                row.getCell('F').value = linha.registro.valor_nd_39;
                row.getCell('F').alignment = centerMiddleAlignment;
                row.getCell('F').numFmt = 'R$ #,##0.00';
                row.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
                
                // G: 33.90.00 (0)
                row.getCell('G').value = 0;
                row.getCell('G').alignment = centerMiddleAlignment;
                row.getCell('G').numFmt = 'R$ #,##0.00';
                row.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
                
                // H: GND 3 (Total da linha)
                row.getCell('H').value = linha.registro.valor_total;
                row.getCell('H').alignment = centerMiddleAlignment;
                row.getCell('H').numFmt = 'R$ #,##0.00';
                row.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
                
                // I: DETALHAMENTO
                const isClasseII = linha.registro.categoria.startsWith('Equipamento') || linha.registro.categoria.startsWith('Proteção') || linha.registro.categoria.startsWith('Material de Estacionamento');
                row.getCell('I').value = generateClasseIIMemoriaCalculo(linha.registro, isClasseII);
                row.getCell('I').alignment = leftTopAlignment;
                row.getCell('I').font = { name: 'Arial', size: 6.5 };
                
                ['A', 'B', 'I'].forEach(col => {
                    row.getCell(col).font = baseFontStyle;
                });
                
                ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
                    row.getCell(col).border = cellBorder;
                });
                currentRow++;
            });
        }
        
        // --- 3. CLASSE III (Combustível e Lubrificante) ---
        if (grupo.linhasClasseIII.length > 0) {
            grupo.linhasClasseIII.forEach(linha => {
                const row = worksheet.getRow(currentRow);
                
                // A: DESPESAS
                const tipoCombustivelLabel = getTipoCombustivelLabel(linha.tipo_suprimento);
                const categoriaEquipamentoLabel = getClasseIILabel(linha.categoria_equipamento);
                row.getCell('A').value = `CLASSE III - ${tipoCombustivelLabel} (${categoriaEquipamentoLabel})`; 
                row.getCell('A').alignment = leftMiddleAlignment; 
                
                // B: OM (UGE) CODUG
                row.getCell('B').value = `${linha.registro.organizacao}\n(${formatCodug(linha.registro.ug)})`;
                row.getCell('B').alignment = centerMiddleAlignment;
                
                // C: 33.90.15 (0)
                row.getCell('C').value = 0;
                row.getCell('C').alignment = centerMiddleAlignment;
                row.getCell('C').numFmt = 'R$ #,##0.00';
                row.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
                
                // D: 33.90.30 (Total)
                row.getCell('D').value = linha.valor_total_linha;
                row.getCell('D').alignment = centerMiddleAlignment;
                row.getCell('D').numFmt = 'R$ #,##0.00';
                row.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
                
                // E, F, G: Outras NDs (0)
                row.getCell('E').value = 0;
                row.getCell('F').value = 0;
                row.getCell('G').value = 0;
                ['E', 'F', 'G'].forEach(col => {
                    row.getCell(col).alignment = centerMiddleAlignment;
                    row.getCell(col).numFmt = 'R$ #,##0.00';
                    row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
                });
                
                // H: GND 3 (Total da linha)
                row.getCell('H').value = linha.valor_total_linha;
                row.getCell('H').alignment = centerMiddleAlignment;
                row.getCell('H').numFmt = 'R$ #,##0.00';
                row.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
                
                // I: DETALHAMENTO
                row.getCell('I').value = linha.memoria_calculo;
                row.getCell('I').alignment = leftTopAlignment;
                row.getCell('I').font = { name: 'Arial', size: 6.5 };
                
                ['A', 'B', 'I'].forEach(col => {
                    row.getCell(col).font = baseFontStyle;
                });
                
                ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
                    row.getCell(col).border = cellBorder;
                });
                currentRow++;
            });
        }
        
        // Subtotal Row for OM
        const subtotalRow = worksheet.getRow(currentRow);
        
        // Célula A+B (Cinza)
        subtotalRow.getCell('A').value = `VALOR TOTAL DO ${omName}`;
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        subtotalRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalRow.getCell('A').font = headerFontStyle;
        subtotalRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotalOM } }; // Cinza
        subtotalRow.getCell('A').border = cellBorder;
        
        // Células C, D, E, F, G, H (NDs - Cinza)
        subtotalRow.getCell('C').value = 0; // 33.90.15
        subtotalRow.getCell('D').value = omTotals.total_33_90_30 + omTotals.valorDiesel + omTotals.valorGasolina; // 33.90.30
        subtotalRow.getCell('E').value = 0; // 33.90.33
        subtotalRow.getCell('F').value = omTotals.total_33_90_39; // 33.90.39
        subtotalRow.getCell('G').value = 0; // 33.90.00
        subtotalRow.getCell('H').value = omTotals.total_gnd3; // GND 3 Total
        
        ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
            const cell = subtotalRow.getCell(col);
            cell.alignment = centerMiddleAlignment;
            cell.font = headerFontStyle;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotalOM } }; // Cinza
            cell.border = cellBorder;
            cell.numFmt = 'R$ #,##0.00';
        });
        
        // Célula I (MUDADO PARA CINZA)
        subtotalRow.getCell('I').value = '';
        subtotalRow.getCell('I').alignment = centerMiddleAlignment;
        subtotalRow.getCell('I').font = headerFontStyle;
        subtotalRow.getCell('I').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotalOM } }; // Cinza
        subtotalRow.getCell('I').border = cellBorder;

        currentRow++;
    });

    // Linha em branco para espaçamento
    currentRow++;
    
    // ========== TOTAL GERAL ==========
    
    // Linha 1: SOMA POR ND E GP DE DESPESA
    const totalGeralSomaRow = worksheet.getRow(currentRow);
    totalGeralSomaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
    totalGeralSomaRow.getCell('A').alignment = rightMiddleAlignment;
    totalGeralSomaRow.getCell('A').font = headerFontStyle;
    totalGeralSomaRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSomaND } }; // Cinza
    totalGeralSomaRow.getCell('A').border = cellBorder;

    // Células C, D, E, F, G, H (NDs - Cinza)
    totalGeralSomaRow.getCell('C').value = 0; // 33.90.15
    totalGeralSomaRow.getCell('D').value = totaisND.nd30; // 33.90.30
    totalGeralSomaRow.getCell('E').value = totaisND.nd33; // 33.90.33
    totalGeralSomaRow.getCell('F').value = totaisND.nd39; // 33.90.39
    totalGeralSomaRow.getCell('G').value = totaisND.nd00; // 33.90.00
    totalGeralSomaRow.getCell('H').value = totaisND.totalGND3; // GND 3 Total

    ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
        const cell = totalGeralSomaRow.getCell(col);
        cell.alignment = centerMiddleAlignment;
        cell.font = headerFontStyle;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSomaND } }; // Cinza
        cell.border = cellBorder;
        cell.numFmt = 'R$ #,##0.00';
    });

    // Célula I (MUDADO PARA CINZA)
    totalGeralSomaRow.getCell('I').value = '';
    totalGeralSomaRow.getCell('I').alignment = centerMiddleAlignment;
    totalGeralSomaRow.getCell('I').font = headerFontStyle;
    totalGeralSomaRow.getCell('I').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSomaND } }; // Cinza
    totalGeralSomaRow.getCell('I').border = cellBorder;

    currentRow++;
    
    // Linha 2: VALOR TOTAL
    const totalGeralFinalRow = worksheet.getRow(currentRow);
    
    // Mescla A até F (Cinza Claro) - Colspan 6
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
    totalGeralFinalRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corGrandTotal } };
    totalGeralFinalRow.getCell('A').border = cellBorder;
    
    // Célula G: VALOR TOTAL (Cinza Claro)
    totalGeralFinalRow.getCell('G').value = 'VALOR TOTAL';
    totalGeralFinalRow.getCell('G').alignment = centerMiddleAlignment;
    totalGeralFinalRow.getCell('G').font = headerFontStyle;
    totalGeralFinalRow.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corGrandTotal } };
    totalGeralFinalRow.getCell('G').border = cellBorder;
    
    // Célula H: Valor Total GND 3 (Cinza Claro)
    totalGeralFinalRow.getCell('H').value = totaisND.totalGND3;
    totalGeralFinalRow.getCell('H').alignment = centerMiddleAlignment;
    totalGeralFinalRow.getCell('H').font = headerFontStyle;
    totalGeralFinalRow.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corGrandTotal } };
    totalGeralFinalRow.getCell('H').border = cellBorder;
    totalGeralFinalRow.getCell('H').numFmt = 'R$ #,##0.00';

    // Célula I: Vazia (Cinza Claro)
    totalGeralFinalRow.getCell('I').value = '';
    totalGeralFinalRow.getCell('I').alignment = centerMiddleAlignment;
    totalGeralFinalRow.getCell('I').font = headerFontStyle;
    totalGeralFinalRow.getCell('I').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corGrandTotal } };
    totalGeralFinalRow.getCell('I').border = cellBorder;

    currentRow++;
    
    currentRow++;
    
    // Rodapé
    const localRow = worksheet.getRow(currentRow);
    localRow.getCell('A').value = `${ptrabData.local_om || 'Local'}, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    localRow.getCell('A').font = { name: 'Arial', size: 10 };
    localRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas
    currentRow += 3;
    
    const cmtRow = worksheet.getRow(currentRow);
    cmtRow.getCell('A').value = ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]';
    cmtRow.getCell('A').font = { name: 'Arial', size: 10, bold: true };
    cmtRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas
    currentRow++;
    
    const cargoRow = worksheet.getRow(currentRow);
    cargoRow.getCell('A').value = `Comandante da ${ptrabData.nome_om_extenso || ptrabData.nome_om}`;
    cargoRow.getCell('A').font = { name: 'Arial', size: 9 };
    cargoRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas

    // Exportar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generateFileName('Excel');
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Excel Exportado!",
      description: "O P Trab Logístico foi salvo com sucesso.",
      duration: 3000,
    });
  }, [ptrabData, totaisND, fileSuffix, diasOperacao, gruposPorOM, omsOrdenadas, calcularTotaisPorOM, generateClasseIMemoriaCalculo, generateClasseIIMemoriaCalculo, generateClasseIIIMemoriaCalculo, toast]);


  return (
    <div className="space-y-4">
      {/* Botões de Exportação/Impressão padronizados */}
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={exportPDF} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
        <Button onClick={exportExcel} variant="outline">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
        <Button onClick={handlePrint} variant="default">
          <Printer className="mr-2 h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* Conteúdo do Relatório (para impressão) */}
      <div ref={contentRef} className="bg-white p-8 shadow-xl print:p-0 print:shadow-none" style={{ padding: '0.5cm' }}>
        <div className="ptrab-header">
          <p className="text-[11pt] font-bold uppercase">Ministério da Defesa</p>
          <p className="text-[11pt] font-bold uppercase">Exército Brasileiro</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.comando_militar_area}</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          <p className="text-[11pt] font-bold uppercase">
            Plano de Trabalho Logístico de Solicitação de Recursos Orçamentários e Financeiros Operação {ptrabData.nome_operacao}
          </p>
          <p className="text-[11pt] font-bold uppercase underline">Plano de Trabalho Logístico</p>
        </div>

        <div className="ptrab-info">
          <p className="info-item"><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p className="info-item"><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado}</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS LOGÍSTICAS REALIZADAS OU A REALIZAR:</p>
        </div>

        {omsOrdenadas.length > 0 ? (
          <div className="ptrab-table-wrapper">
            <table className="ptrab-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="col-despesas">DESPESAS</th>
                  <th rowSpan={2} className="col-om">OM (UGE)<br/>CODUG</th>
                  <th colSpan={6} className="col-nd-group">NATUREZA DE DESPESA</th>
                  <th rowSpan={2} className="col-detalhamento">DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/>OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG</th>
                </tr>
                <tr>
                    <th className="col-nd-small">33.90.15</th>
                    <th className="col-nd-small">33.90.30</th>
                    <th className="col-nd-small">33.90.33</th>
                    <th className="col-nd-small">33.90.39</th>
                    <th className="col-nd-small">33.90.00</th>
                    <th className="col-nd-small total-gnd3-cell">GND 3</th>
                </tr>
            </thead>
            <tbody>
              {omsOrdenadas.map((omKey) => {
                const grupo = gruposPorOM[omKey];
                const omTotals = calcularTotaisPorOM(grupo, omKey);
                const omName = omKey.split(' (')[0];
                const ug = omKey.split(' (')[1].replace(')', '');
                
                const isRMFornecedora = omKey === nomeRM;

                return (
                    <React.Fragment key={omKey}>
                        {/* Linha de Título da OM */}
                        <tr className="om-title-row">
                            <td colSpan={9} className="text-left font-bold">
                                OM: {omName} (UG: {formatCodug(ug)})
                            </td>
                        </tr>
                        
                        {/* 1. CLASSE I (QS/QR) */}
                        {grupo.linhasQS.length > 0 && (
                            <tr className="expense-row">
                                <td className="col-despesas">CLASSE I - QS</td>
                                <td className="col-om">
                                    <div>{grupo.linhasQS[0].registro.om_qs || grupo.linhasQS[0].registro.organizacao}</div>
                                    <div>({formatCodug(grupo.linhasQS[0].registro.ugQS || grupo.linhasQS[0].registro.ug)})</div>
                                </td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small">{formatCurrency(omTotals.totalQS)}</td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small total-gnd3-cell">{formatCurrency(omTotals.totalQS)}</td>
                                <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                                    <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                        {generateClasseIMemoriaCalculo(grupo.linhasQS[0].registro, 'QS')}
                                    </pre>
                                </td>
                            </tr>
                        )}
                        {grupo.linhasQR.length > 0 && (
                            <tr className="expense-row">
                                <td className="col-despesas">CLASSE I - QR</td>
                                <td className="col-om">
                                    <div>{grupo.linhasQR[0].registro.organizacao}</div>
                                    <div>({formatCodug(grupo.linhasQR[0].registro.ug)})</div>
                                </td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small">{formatCurrency(omTotals.totalQR)}</td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small total-gnd3-cell">{formatCurrency(omTotals.totalQR)}</td>
                                <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                                    <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                        {generateClasseIMemoriaCalculo(grupo.linhasQR[0].registro, 'QR')}
                                    </pre>
                                </td>
                            </tr>
                        )}
                        
                        {/* 2. CLASSE III (Combustível e Lubrificante) - Apenas se for RM Fornecedora */}
                        {isRMFornecedora && grupo.linhasClasseIII.length > 0 && (
                            <>
                                {grupo.linhasClasseIII.filter(l => l.tipo_suprimento === 'COMBUSTIVEL_DIESEL').length > 0 && (
                                    <tr className="expense-row">
                                        <td className="col-despesas">CLASSE III - DIESEL</td>
                                        <td className="col-om">
                                            <div>{grupo.linhasClasseIII.find(l => l.tipo_suprimento === 'COMBUSTIVEL_DIESEL')?.registro.organizacao}</div>
                                            <div>({formatCodug(grupo.linhasClasseIII.find(l => l.tipo_suprimento === 'COMBUSTIVEL_DIESEL')?.registro.ug)})</div>
                                        </td>
                                        <td className="col-nd-small">{formatCurrency(0)}</td>
                                        <td className="col-nd-small">{formatCurrency(omTotals.valorDiesel)}</td>
                                        <td className="col-nd-small">{formatCurrency(0)}</td>
                                        <td className="col-nd-small">{formatCurrency(0)}</td>
                                        <td className="col-nd-small">{formatCurrency(0)}</td>
                                        <td className="col-nd-small total-gnd3-cell">{formatCurrency(omTotals.valorDiesel)}</td>
                                        <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                                            <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                {grupo.linhasClasseIII.filter(l => l.tipo_suprimento === 'COMBUSTIVEL_DIESEL').map(l => l.memoria_calculo).join('\n\n').trim()}
                                            </pre>
                                        </td>
                                    </tr>
                                )}
                                {grupo.linhasClasseIII.filter(l => l.tipo_suprimento === 'COMBUSTIVEL_GASOLINA').length > 0 && (
                                    <tr className="expense-row">
                                        <td className="col-despesas">CLASSE III - GASOLINA</td>
                                        <td className="col-om">
                                            <div>{grupo.linhasClasseIII.find(l => l.tipo_suprimento === 'COMBUSTIVEL_GASOLINA')?.registro.organizacao}</div>
                                            <div>({formatCodug(grupo.linhasClasseIII.find(l => l.tipo_suprimento === 'COMBUSTIVEL_GASOLINA')?.registro.ug)})</div>
                                        </td>
                                        <td className="col-nd-small">{formatCurrency(0)}</td>
                                        <td className="col-nd-small">{formatCurrency(omTotals.valorGasolina)}</td>
                                        <td className="col-nd-small">{formatCurrency(0)}</td>
                                        <td className="col-nd-small">{formatCurrency(0)}</td>
                                        <td className="col-nd-small">{formatCurrency(0)}</td>
                                        <td className="col-nd-small total-gnd3-cell">{formatCurrency(omTotals.valorGasolina)}</td>
                                        <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                                            <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                {grupo.linhasClasseIII.filter(l => l.tipo_suprimento === 'COMBUSTIVEL_GASOLINA').map(l => l.memoria_calculo).join('\n\n').trim()}
                                            </pre>
                                        </td>
                                    </tr>
                                )}
                                {grupo.linhasClasseIII.filter(l => l.tipo_suprimento === 'LUBRIFICANTE').length > 0 && (
                                    <tr className="expense-row">
                                        <td className="col-despesas">CLASSE III - LUBRIFICANTE</td>
                                        <td className="col-om">
                                            <div>{grupo.linhasClasseIII.find(l => l.tipo_suprimento === 'LUBRIFICANTE')?.registro.organizacao}</div>
                                            <div>({formatCodug(grupo.linhasClasseIII.find(l => l.tipo_suprimento === 'LUBRIFICANTE')?.registro.ug)})</div>
                                        </td>
                                        <td className="col-nd-small">{formatCurrency(0)}</td>
                                        <td className="col-nd-small">{formatCurrency(omTotals.totalLubrificante)}</td>
                                        <td className="col-nd-small">{formatCurrency(0)}</td>
                                        <td className="col-nd-small">{formatCurrency(0)}</td>
                                        <td className="col-nd-small">{formatCurrency(0)}</td>
                                        <td className="col-nd-small total-gnd3-cell">{formatCurrency(omTotals.totalLubrificante)}</td>
                                        <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                                            <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                {grupo.linhasClasseIII.filter(l => l.tipo_suprimento === 'LUBRIFICANTE').map(l => l.memoria_calculo).join('\n\n').trim()}
                                            </pre>
                                        </td>
                                    </tr>
                                )}
                            </>
                        )}
                        
                        {/* 3. CLASSES II, V, VI, VII, VIII, IX */}
                        {[...grupo.linhasClasseII, ...grupo.linhasClasseV, ...grupo.linhasClasseVI, ...grupo.linhasClasseVII, ...grupo.linhasClasseVIII, ...grupo.linhasClasseIX].map((linha, index) => {
                            const isClasseII = linha.registro.categoria.startsWith('Equipamento') || linha.registro.categoria.startsWith('Proteção') || linha.registro.categoria.startsWith('Material de Estacionamento');
                            
                            return (
                                <tr key={linha.registro.id} className="expense-row">
                                    <td className="col-despesas">CLASSE {linha.registro.categoria.split(' ')[0]} - {getClasseIILabel(linha.registro.categoria)}</td>
                                    <td className="col-om">
                                        <div>{linha.registro.organizacao}</div>
                                        <div>({formatCodug(linha.registro.ug)})</div>
                                    </td>
                                    <td className="col-nd-small">{formatCurrency(0)}</td>
                                    <td className="col-nd-small">{formatCurrency(linha.registro.valor_nd_30)}</td>
                                    <td className="col-nd-small">{formatCurrency(0)}</td>
                                    <td className="col-nd-small">{formatCurrency(linha.registro.valor_nd_39)}</td>
                                    <td className="col-nd-small">{formatCurrency(0)}</td>
                                    <td className="col-nd-small total-gnd3-cell">{formatCurrency(linha.registro.valor_total)}</td>
                                    <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                                        <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                            {generateClasseIIMemoriaCalculo(linha.registro, isClasseII)}
                                        </pre>
                                    </td>
                                </tr>
                            );
                        })}
                        
                        {/* Subtotal Row */}
                        <tr className="subtotal-om-row">
                            <td colSpan={2} className="text-right font-bold">
                                VALOR TOTAL DO {omName}
                            </td>
                            <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                            <td className="col-nd-small text-center font-bold">{formatCurrency(omTotals.total_33_90_30 + omTotals.valorDiesel + omTotals.valorGasolina)}</td>
                            <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                            <td className="col-nd-small text-center font-bold">{formatCurrency(omTotals.total_33_90_39)}</td>
                            <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                            <td className="col-nd-small text-center font-bold total-gnd3-cell">{formatCurrency(omTotals.total_gnd3)}</td>
                            <td></td>
                        </tr>
                    </React.Fragment>
                );
              })}
              
              {/* Linha em branco para espaçamento */}
              <tr className="spacing-row">
                <td colSpan={9} style={{ height: '10px', border: 'none', backgroundColor: 'transparent', borderLeft: 'none', borderRight: 'none' }}></td>
              </tr>
              
              {/* Grand Total Row 1: SOMA POR ND E GP DE DESPESA */}
              <tr className="total-geral-soma-row">
                <td colSpan={2} className="text-right font-bold">
                    SOMA POR ND E GP DE DESPESA
                </td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(totaisND.nd30)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(totaisND.nd33)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(totaisND.nd39)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(totaisND.nd00)}</td>
                <td className="col-nd-small text-center font-bold total-gnd3-cell">{formatCurrency(totaisND.totalGND3)}</td>
                <td></td>
              </tr>
              
              {/* Grand Total Row 2: VALOR TOTAL */}
              <tr className="total-geral-final-row">
                <td colSpan={6}></td>
                <td className="text-center font-bold" style={{ whiteSpace: 'nowrap' }}>VALOR TOTAL</td>
                <td className="text-center font-bold">{formatCurrency(totaisND.totalGND3)}</td>
                <td></td>
              </tr>
            </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Nenhum registro logístico (Classe I, II, III, V, VI, VII, VIII, IX) cadastrado.</p>
        )}

        <div className="ptrab-footer print-avoid-break">
          <p className="text-[10pt]">{ptrabData.local_om || 'Local'}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div className="signature-block">
            <p className="text-[10pt] font-bold">{ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]'}</p>
            <p className="text-[9pt]">Comandante da {ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          </div>
        </div>
      </div>

      <style>{`
        @page {
          size: A4 landscape;
          margin: 0.5cm;
        }
        
        /* REGRAS DE ESTILO UNIFICADAS (TELA E IMPRESSÃO) */
        .ptrab-header { text-align: center; margin-bottom: 1.5rem; line-height: 1.4; }
        .ptrab-header p { font-size: 11pt; } 
        .ptrab-info { margin-bottom: 0.3rem; font-size: 10pt; line-height: 1.3; }
          .info-item { margin-bottom: 0.15rem; }
        .ptrab-table-wrapper { margin-top: 0.2rem; margin-bottom: 2rem; overflow-x: auto; }
        .ptrab-table { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; line-height: 1.1; }
        .ptrab-table th, .ptrab-table td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; font-size: 8pt; } 
        .ptrab-table thead th { background-color: #D9D9D9; font-weight: bold; text-align: center; font-size: 9pt; }
        
        .om-title-row td { background-color: #E8E8E8; font-size: 9pt; padding: 4px; }
        .expense-row { page-break-inside: avoid; } 
        
        /* LARGURAS DE COLUNA FIXAS */
        .col-despesas { width: 20%; text-align: left; vertical-align: middle; } 
        .col-om { width: 10%; text-align: center; vertical-align: top; }
        .col-nd-group { background-color: #D9D9D9; font-weight: bold; text-align: center; }
        .col-nd-small { 
            width: 7%; 
            text-align: center; 
            vertical-align: middle; 
            background-color: #B4C7E7 !important; /* Fundo Azul para NDs (APENAS LINHAS DE DADOS) */
        }
        .col-detalhamento { width: 38%; text-align: left; vertical-align: top; }
        
        .total-gnd3-cell { background-color: #B4C7E7 !important; }
        
        /* Estilos para Subtotal OM */
        .subtotal-om-row { 
            font-weight: bold; 
            page-break-inside: avoid; 
            background-color: #D9D9D9; /* Cinza */
        }
        .subtotal-om-row td {
            border: 1px solid #000 !important;
            padding: 3px 4px;
            background-color: #D9D9D9 !important;
        }
        .subtotal-om-row td:nth-child(1) { /* Colspan 2 */
            text-align: right;
        }
        
        /* Estilos para Total Geral */
        .total-geral-soma-row {
            font-weight: bold;
            page-break-inside: avoid;
            background-color: #D9D9D9; /* Cinza */
        }
        .total-geral-soma-row td {
            border: 1px solid #000 !important;
            padding: 3px 4px;
            background-color: #D9D9D9 !important;
        }
        .total-geral-soma-row td:nth-child(1) { /* Colspan 2 */
            text-align: right;
        }
        
        .total-geral-final-row {
            font-weight: bold;
            page-break-inside: avoid;
            background-color: #E8E8E8; /* Cinza Claro */
        }
        .total-geral-final-row td {
            border: 1px solid #000 !important;
            padding: 3px 4px;
            background-color: #E8E8E8 !important;
        }
        .total-geral-final-row td:nth-child(1) { /* Colspan 6 */
            text-align: right;
        }
        
        /* AJUSTE DE ALINHAMENTO DO RODAPÉ */
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; display: inline-block; text-align: center; }
        
        /* REGRAS ESPECÍFICAS DE IMPRESSÃO */
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .expense-row { page-break-inside: avoid !important; } 
          .ptrab-table thead { display: table-row-group; break-inside: avoid; break-after: auto; }
          .ptrab-table th, .ptrab-table td { border: 0.25pt solid #000 !important; } 
          .ptrab-table { border: 0.25pt solid #000 !important; }
          .ptrab-table td { vertical-align: top !important; } 
          
          /* NDs nas linhas de DADOS continuam azuis */
          .expense-row .col-nd-small { 
              background-color: #B4C7E7 !important; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          .expense-row .total-gnd3-cell {
              background-color: #B4C7E7 !important; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          
          /* Subtotal e Totais agora são Cinza */
          .subtotal-om-row td, .total-geral-soma-row td {
              background-color: #D9D9D9 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          .total-geral-final-row td {
              background-color: #E8E8E8 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          
          .print-avoid-break {
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PTrabLogisticoReport;