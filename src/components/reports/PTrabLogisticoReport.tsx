import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA, formatCodug } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download } from "lucide-react";
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
// COMPONENTE PRINCIPAL
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
  fileSuffix, // NOVO PROP
  generateClasseIMemoriaCalculo, // DESESTRUTURANDO A FUNÇÃO
  generateClasseIIMemoriaCalculo = defaultGenerateClasseIIMemoriaCalculo, // CORRIGIDO: Usando o nome correto da função de fallback
  generateClasseVMemoriaCalculo = defaultGenerateClasseVMemoriaCalculo, // NOVO: DESESTRUTURANDO E USANDO DEFAULT
  generateClasseVIMemoriaCalculo = defaultGenerateClasseVIMemoriaCalculo, // NOVO: ADICIONADO CLASSE VI
  generateClasseVIIMemoriaCalculo = defaultGenerateClasseVIIMemoriaCalculo, // NOVO: ADICIONADO CLASSE VII
  generateClasseVIIIMemoriaCalculo = defaultGenerateClasseVIIIMemoriaCalculo, // NOVO: ADICIONADO CLASSE VIII
  generateClasseIIIMemoriaCalculo = defaultGenerateClasseIIIMemoriaCalculo, // NOVO: ADICIONADO CLASSE III
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const isLubrificante = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
  const isCombustivel = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';

  // 1. Recalcular Totais Gerais (para HTML/PDF)
  const totalGeral_33_90_30 = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.om_qs || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasClasseIII[0]?.registro.organizacao || '').total_33_90_30, 0), [gruposPorOM, calcularTotaisPorOM]);
  const totalGeral_33_90_39 = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.om_qs || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasClasseIII[0]?.registro.organizacao || '').total_33_90_39, 0), [gruposPorOM, calcularTotaisPorOM]);
  
  // NOVO: Cálculo dos totais gerais de combustível (litros e valor)
  const { totalDiesel, totalGasolina, totalValorCombustivelFinal } = useMemo(() => {
    let totalDiesel = 0;
    let totalGasolina = 0;
    let totalValorCombustivelFinal = 0;

    // Itera sobre todas as OMs e soma os totais de combustível (que só estarão preenchidos na RM fornecedora)
    omsOrdenadas.forEach(nomeOM => {
        const grupo = gruposPorOM[nomeOM];
        if (grupo) {
            const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
            totalDiesel += totaisOM.totalDieselLitros;
            totalGasolina += totaisOM.totalGasolinaLitros;
            totalValorCombustivelFinal += totaisOM.total_combustivel;
        }
    });

    return { totalDiesel, totalGasolina, totalValorCombustivelFinal };
  }, [omsOrdenadas, gruposPorOM, calcularTotaisPorOM]);
  
  const totalGeral_GND3_ND = totalGeral_33_90_30 + totalGeral_33_90_39;
  const valorTotalSolicitado = totalGeral_GND3_ND + totalValorCombustivelFinal;
  
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  
  // NOVO: Função para gerar o nome do arquivo
  const generateFileName = (reportType: 'PDF' | 'Excel') => {
    // Usa a função atualizada que retorna DDMMMAA
    const dataAtz = formatDateDDMMMAA(ptrabData.updated_at);
    // Substitui barras por hífens para segurança no nome do arquivo
    const numeroPTrab = ptrabData.numero_ptrab.replace(/\//g, '-'); 
    
    const isMinuta = ptrabData.numero_ptrab.startsWith("Minuta");
    const currentYear = new Date(ptrabData.periodo_inicio).getFullYear();
    
    // 1. Construir o nome base
    let nomeBase = `P Trab Nr ${numeroPTrab}`;
    
    if (isMinuta) {
        // Se for Minuta, adiciona o ano e a sigla da OM
        nomeBase += ` - ${currentYear} - ${ptrabData.nome_om}`;
    } else {
        // Se for Aprovado, o número já contém o ano e a sigla da OM (ex: 1-2025-23ª Bda Inf Sl)
        // Apenas adiciona a sigla da OM para clareza, mas sem o separador extra
        // Ex: P Trab Nr 1-2025-23ª Bda Inf Sl - Op MARAJOARA...
    }
    
    // 2. Adicionar o nome da operação
    nomeBase += ` - ${ptrabData.nome_operacao}`;
    
    // 3. Adicionar a data de atualização e o sufixo da aba
    // A data já está no formato DDMMMAA (sem barras)
    nomeBase += ` - Atz ${dataAtz} - ${fileSuffix}`;
    
    return `${nomeBase}.${reportType === 'PDF' ? 'pdf' : 'xlsx'}`;
  };

  // RENOMEADO: Função que era handlePrint, agora é exportPDF
  const exportPDF = useCallback(() => {
    if (!contentRef.current) return;

    const pdfToast = toast({
      title: "Gerando PDF...",
      description: "Aguarde enquanto o relatório é processado.",
    });

    // OTIMIZAÇÃO: Forçar a captura do estilo de impressão e aumentar a escala
    html2canvas(contentRef.current, {
      scale: 3, // Aumenta a escala para maior nitidez
      useCORS: true,
      allowTaint: true,
    }).then((canvas) => {
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      // A4 em Paisagem: 297mm (largura) x 210mm (altura)
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = 297; // Largura do A4 em mm (Paisagem)
      const pdfHeight = 210; // Altura do A4 em mm (Paisagem)
      
      // Margem de 0.5cm = 5mm
      const margin = 5;
      const contentWidth = pdfWidth - 2 * margin;
      const contentHeight = pdfHeight - 2 * margin;

      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin; // Começa com a margem superior

      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= contentHeight;

      while (heightLeft > -1) { // Ajustado para garantir que a última parte seja incluída
        position = heightLeft - imgHeight + margin; // Calcula a posição para a próxima página
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= contentHeight;
      }

      pdf.save(generateFileName('PDF'));
      // REMOVIDO: onExportSuccess();
      pdfToast.dismiss(); // Usa o dismiss do objeto retornado
      toast({
        title: "PDF Exportado!",
        description: "O P Trab Logístico foi salvo com sucesso.",
        duration: 3000,
      });
    }).catch(error => {
      console.error("Erro ao gerar PDF:", error);
      pdfToast.dismiss(); // Usa o dismiss do objeto retornado
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    });
  }, [ptrabData, toast, diasOperacao, totalGeral_GND3_ND, valorTotalSolicitado, totalGeral_33_90_30, totalGeral_33_90_39, nomeRM, omsOrdenadas, gruposPorOM, calcularTotaisPorOM, fileSuffix, generateClasseVIIIMemoriaCalculo]);

  // NOVO: Função para abrir o diálogo de impressão do navegador
  const handlePrint = () => {
    window.print();
    // REMOVIDO: onExportSuccess();
  };

  const exportExcel = useCallback(async () => {
    if (!ptrabData) return;

    // --- Definição de Estilos e Alinhamentos ---
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const centerTopAlignment = { horizontal: 'center' as const, vertical: 'top' as const, wrapText: true };
    const rightTopAlignment = { horizontal: 'right' as const, vertical: 'top' as const, wrapText: true };
    
    // NOVOS ALINHAMENTOS PARA DADOS (Verticalmente Centralizado)
    const dataLeftMiddleAlignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
    const dataCenterMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    // Alterado para CenterMiddleAlignment para C, D, E e H
    const dataCenterMonetaryAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true }; 
    
    const cellBorder = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    };
    
    const baseFontStyle = { name: 'Arial', size: 8 };
    const headerFontStyle = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF000000' } }; // Cor da fonte preta
    const titleFontStyle = { name: 'Arial', size: 11, bold: true };
    
    // Cores padronizadas para o Excel (ARGB)
    const corAzul = 'FFB4C7E7'; // Natureza de Despesa (33.90.30/39/Total)
    const corLaranja = 'FFF8CBAD'; // Combustível (Litros/Preço Unitário/Preço Total)
    const corSubtotal = 'FFD3D3D3'; // SOMA POR ND E GP DE DESPESA (Fundo cinza)
    const corTotalOM = 'FFE8E8E8'; // VALOR TOTAL DO OM (Fundo cinza muito claro)
    // -------------------------------------------

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('P Trab Logístico');
      
      worksheet.columns = [
        { width: 35 }, // A - DESPESAS
        { width: 20 }, // B - OM (UGE) CODUG
        { width: 15 }, // C - 33.90.30
        { width: 15 }, // D - 33.90.39
        { width: 15 }, // E - TOTAL ND
        { width: 15 }, // F - LITROS
        { width: 15 }, // G - PREÇO UNITÁRIO
        { width: 18 }, // H - PREÇO TOTAL
        { width: 70 }, // I - DETALHAMENTO
      ];
      
      let currentRow = 1;
      
      const addHeaderRow = (text: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = text;
        row.getCell(1).font = titleFontStyle;
        row.getCell(1).alignment = centerMiddleAlignment;
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
        currentRow++;
      };
      
      addHeaderRow('MINISTÉRIO DA DEFESA');
      addHeaderRow('EXÉRCITO BRASILEIRO');
      addHeaderRow(ptrabData.comando_militar_area.toUpperCase());
      
      const omExtensoRow = worksheet.getRow(currentRow);
      omExtensoRow.getCell(1).value = (ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase();
      omExtensoRow.getCell(1).font = titleFontStyle;
      omExtensoRow.getCell('A').alignment = centerMiddleAlignment;
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;
      
      const fullTitleRow = worksheet.getRow(currentRow);
      fullTitleRow.getCell('A').value = `PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
      fullTitleRow.getCell('A').font = titleFontStyle;
      fullTitleRow.getCell('A').alignment = centerMiddleAlignment;
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;

      const shortTitleRow = worksheet.getRow(currentRow);
      shortTitleRow.getCell('A').value = 'PLANO DE TRABALHO LOGÍSTICO';
      shortTitleRow.getCell('A').font = { ...titleFontStyle, underline: true };
      shortTitleRow.getCell('A').alignment = centerMiddleAlignment;
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;
      
      currentRow++;
      
      const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
      
      const addInfoRow = (label: string, value: string) => {
        const row = worksheet.getRow(currentRow);
        
        row.getCell(1).value = {
          richText: [
            { text: label, font: titleFontStyle },
            { text: ` ${value}`, font: { name: 'Arial', size: 11, bold: false } }
          ]
        };
        
        row.getCell(1).alignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
        currentRow++;
      };
      
      addInfoRow('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
      addInfoRow('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${diasOperacao}`);
      addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado} militares do Exército Brasileiro`);
      addInfoRow('4. AÇÕES:', ptrabData.acoes || '');
      
      const despesasRow = worksheet.getRow(currentRow);
      despesasRow.getCell('A').value = '5. DESPESAS OPERACIONAIS:';
      despesasRow.getCell('A').font = titleFontStyle;
      currentRow++;
      
      const headerRow1 = currentRow;
      const headerRow2 = currentRow + 1;
      
      const hdr1 = worksheet.getRow(headerRow1);
      // CORRIGIDO: Adicionando os textos completos
      hdr1.getCell('A').value = 'DESPESAS'; 
      hdr1.getCell('B').value = 'OM (UGE)\nCODUG';
      hdr1.getCell('C').value = 'NATUREZA DE DESPESA';
      hdr1.getCell('F').value = 'COMBUSTÍVEL';
      hdr1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG';
      
      // Mesclagens
      worksheet.mergeCells(`A${headerRow1}:A${headerRow2}`);
      worksheet.mergeCells(`B${headerRow1}:B${headerRow2}`);
      worksheet.mergeCells(`C${headerRow1}:E${headerRow1}`);
      worksheet.mergeCells(`F${headerRow1}:H${headerRow1}`);
      worksheet.mergeCells(`I${headerRow1}:I${headerRow2}`);
      
      const hdr2 = worksheet.getRow(headerRow2);
      hdr2.getCell('C').value = '33.90.30';
      hdr2.getCell('D').value = '33.90.39';
      hdr2.getCell('E').value = 'TOTAL';
      hdr2.getCell('F').value = 'LITROS';
      hdr2.getCell('G').value = 'PREÇO\nUNITÁRIO';
      hdr2.getCell('H').value = 'PREÇO\nTOTAL';
      
      const headerStyle = {
        font: headerFontStyle,
        alignment: centerMiddleAlignment,
        border: cellBorder
      };
      
      // --- APLICAÇÃO DE ESTILOS E CORES EXPLÍCITAS ---
      const headerFillGray = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } }; // FFE8E8E8
      const headerFillAzul = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } }; // FFB4C7E7
      const headerFillLaranja = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } }; // FFF8CBAD
      
      const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

      // Linha 1 do Cabeçalho (hdr1)
      headerCols.forEach(col => {
          const cell = hdr1.getCell(col);
          cell.style = headerStyle;
          cell.border = cellBorder;
          if (col === 'A' || col === 'B' || col === 'I') {
              cell.fill = headerFillGray;
          } else if (col === 'C' || col === 'D' || col === 'E') {
              cell.fill = headerFillAzul;
              cell.font = headerFontStyle; // Garante letra preta
          } else if (col === 'F' || col === 'G' || col === 'H') {
              cell.fill = headerFillLaranja;
              cell.font = headerFontStyle; // Garante letra preta
          }
      });

      // Linha 2 do Cabeçalho (hdr2)
      headerCols.forEach(col => {
          const cell = hdr2.getCell(col);
          cell.style = headerStyle;
          cell.border = cellBorder;
          if (col === 'A' || col === 'B' || col === 'I') {
              cell.fill = headerFillGray;
          } else if (col === 'C' || col === 'D' || col === 'E') {
              cell.fill = headerFillAzul;
              cell.font = headerFontStyle; // Garante letra preta
          } else if (col === 'F' || col === 'G' || col === 'H') {
              cell.fill = headerFillLaranja;
              cell.font = headerFontStyle; // Garante letra preta
          }
          // Ajuste para garantir que as células mescladas não tenham valor na linha 2
          if (col === 'A' || col === 'B' || col === 'I') {
              cell.value = '';
          }
      });
      
      currentRow = headerRow2 + 1;

      // Reusable alignment styles for data
      const dataTextStyle = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
      
      omsOrdenadas.forEach((nomeOM) => {
        const grupo = gruposPorOM[nomeOM];
        const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
        
        if (grupo.linhasQS.length === 0 && grupo.linhasQR.length === 0 && grupo.linhasClasseII.length === 0 && grupo.linhasClasseV.length === 0 && grupo.linhasClasseVI.length === 0 && grupo.linhasClasseVII.length === 0 && grupo.linhasClasseVIII.length === 0 && grupo.linhasClasseIX.length === 0 && grupo.linhasClasseIII.length === 0 && (nomeOM !== nomeRM || registrosClasseIII.filter(isCombustivel).length === 0)) {
          return;
        }
        
        // Linhas de Classe III (Lubrificante e Combustível) - Ordenação interna
        const linhasClasseIIIOrdenadas = grupo.linhasClasseIII.sort((a, b) => {
            // Ordena Lubrificante antes de Combustível
            if (a.tipo_suprimento === 'LUBRIFICANTE' && b.tipo_suprimento !== 'LUBRIFICANTE') return -1;
            if (a.tipo_suprimento !== 'LUBRIFICANTE' && b.tipo_suprimento === 'LUBRIFICANTE') return 1;
            
            // Dentro de Combustível, ordena Diesel antes de Gasolina
            if (a.tipo_suprimento === 'COMBUSTIVEL_DIESEL' && b.tipo_suprimento === 'COMBUSTIVEL_GASOLINA') return -1;
            if (a.tipo_suprimento === 'COMBUSTIVEL_GASOLINA' && b.tipo_suprimento === 'COMBUSTIVEL_DIESEL') return 1;
            
            // Ordena por categoria de equipamento
            return a.categoria_equipamento.localeCompare(b.categoria_equipamento);
        });
        
        // NOVO: Array de todas as linhas de despesa na ordem correta (I, II, III, V-IX)
        const allExpenseLines = [
            ...grupo.linhasQS,
            ...grupo.linhasQR,
            ...grupo.linhasClasseII,
            ...linhasClasseIIIOrdenadas, // CLASSE III INSERIDA AQUI
            ...grupo.linhasClasseV,
            ...grupo.linhasClasseVI,
            ...grupo.linhasClasseVII,
            ...grupo.linhasClasseVIII,
            ...grupo.linhasClasseIX,
        ];

        // Renderizar todas as linhas de despesa (I, II, III, V-IX)
        allExpenseLines.forEach((linha, index) => {
            const row = worksheet.getRow(currentRow);
            
            // Type guards to determine the type of line
            const isClasseI = 'tipo' in linha;
            const isClasseIII = 'categoria_equipamento' in linha;
            const isClasseII_IX = !isClasseI && !isClasseIII; // Must be LinhaClasseII

            // ADICIONANDO VERIFICAÇÃO DE SEGURANÇA AQUI
            if (!linha) return;
            
            let rowData = {
                despesasValue: '',
                omValue: '',
                detalhamentoValue: '',
                valorC: 0,
                valorD: 0,
                valorE: 0,
                litrosF: '',
                precoUnitarioG: '',
                precoTotalH: '',
            };
            
            if (isClasseI) { // Classe I (QS/QR)
                const registro = (linha as LinhaTabela).registro as ClasseIRegistro;
                const tipo = (linha as LinhaTabela).tipo;
                const ug_qs_formatted = formatCodug(registro.ug_qs);
                const ug_qr_formatted = formatCodug(registro.ug);

                if (tipo === 'QS') {
                    rowData.despesasValue = `CLASSE I - SUBSISTÊNCIA\n${registro.organizacao}`;
                    rowData.omValue = `${registro.om_qs}\n(${ug_qs_formatted})`;
                    rowData.valorC = registro.total_qs;
                    rowData.valorE = registro.total_qs;
                    rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QS');
                } else { // QR
                    rowData.despesasValue = `CLASSE I - SUBSISTÊNCIA`;
                    rowData.omValue = `${registro.organizacao}\n(${ug_qr_formatted})`;
                    rowData.valorC = registro.total_qr;
                    rowData.valorE = registro.total_qr;
                    rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QR');
                }
            } else if (isClasseIII) { // Classe III (Combustível/Lubrificante)
                const linhaClasseIII = linha as LinhaClasseIII;
                const registro = linhaClasseIII.registro;
                const isCombustivelLinha = linhaClasseIII.tipo_suprimento !== 'LUBRIFICANTE';
                const isLubrificanteLinha = linhaClasseIII.tipo_suprimento === 'LUBRIFICANTE';
                
                // OM Detentora do Equipamento (Source)
                const omDetentoraEquipamento = registro.organizacao;
                
                // 1ª Linha: CLASSE III - DIESEL/GASOLINA/LUBRIFICANTE
                const tipoSuprimentoLabel = isLubrificanteLinha ? 'LUBRIFICANTE' : getTipoCombustivelLabel(linhaClasseIII.tipo_suprimento);
                let despesasValue = `CLASSE III - ${tipoSuprimentoLabel}`;
                
                // 2ª Linha: CATEGORIA
                const categoriaEquipamento = getTipoEquipamentoLabel(linhaClasseIII.categoria_equipamento);
                despesasValue += `\n${categoriaEquipamento}`;
                
                // 3ª Linha: OM Detentora (se for necessário, ou seja, se for diferente da OM de destino do recurso)
                const omDestinoRecurso = isCombustivelLinha ? nomeOM : (registro.om_detentora || registro.organizacao);
                const isDifferentOm = omDetentoraEquipamento !== omDestinoRecurso;
                
                if (isDifferentOm) {
                    despesasValue += `\n${omDetentoraEquipamento}`;
                }
                
                // OM (UGE) CODUG: OM de Destino do Recurso
                const ugDestinoRecurso = isCombustivelLinha ? (registro.ug_detentora || '') : (registro.ug_detentora || registro.ug);
                const ugDestinoFormatted = formatCodug(ugDestinoRecurso);
                let omValue = `${omDestinoRecurso}\n(${ugDestinoFormatted})`;
                
                rowData.despesasValue = despesasValue;
                rowData.omValue = omValue;
                
                if (isCombustivelLinha) {
                    rowData.valorC = 0;
                    rowData.valorD = 0;
                    rowData.valorE = 0;
                    
                    rowData.litrosF = `${formatNumber(linhaClasseIII.total_litros_linha)} L`;
                    rowData.precoUnitarioG = formatCurrency(linhaClasseIII.preco_litro_linha);
                    rowData.precoTotalH = formatCurrency(linhaClasseIII.valor_total_linha);
                    
                } else if (isLubrificanteLinha) {
                    rowData.valorC = linhaClasseIII.valor_total_linha;
                    rowData.valorD = 0;
                    rowData.valorE = linhaClasseIII.valor_total_linha;
                    
                    rowData.litrosF = '';
                    rowData.precoUnitarioG = '';
                    rowData.precoTotalH = '';
                }
                
                rowData.detalhamentoValue = linhaClasseIII.memoria_calculo;
                
            } else if (isClasseII_IX) { // Classe II, V, VI, VII, VIII, IX
                const registro = (linha as LinhaClasseII).registro as ClasseIIRegistro;
                const omDestinoRecurso = registro.organizacao;
                const ugDestinoRecurso = formatCodug(registro.ug);
                
                let categoriaDetalhe = getClasseIILabel(registro.categoria); // Usar rótulo completo
                
                if (registro.categoria === 'Remonta/Veterinária' && registro.animal_tipo) {
                    categoriaDetalhe = registro.animal_tipo;
                }
                                
                const omDetentora = registro.om_detentora || omDestinoRecurso;
                const isDifferentOm = omDetentora !== omDestinoRecurso;
                
                // 1. Define o prefixo CLASSE X
                let prefixoClasse = '';
                if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE V';
                } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE VI';
                } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE VII';
                } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE VIII';
                } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE IX';
                } else {
                    prefixoClasse = 'CLASSE II';
                }
                
                rowData.despesasValue = `${prefixoClasse} - ${categoriaDetalhe.toUpperCase()}`;
                
                // 2. Adiciona a OM Detentora se for diferente da OM de Destino
                if (isDifferentOm) {
                    rowData.despesasValue += `\n${omDetentora}`;
                }
                
                rowData.omValue = `${omDestinoRecurso}\n(${ugDestinoRecurso})`;
                rowData.valorC = registro.valor_nd_30;
                rowData.valorD = registro.valor_nd_39;
                rowData.valorE = registro.valor_nd_30 + registro.valor_nd_39;
                
                // 3. Prioriza o detalhamento customizado ou usa a função de memória unificada
                if (registro.detalhamento_customizado) {
                    rowData.detalhamentoValue = registro.detalhamento_customizado;
                } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                    rowData.detalhamentoValue = generateClasseIXMemoriaCalculo(registro);
                } else if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
                    rowData.detalhamentoValue = generateClasseVMemoriaCalculo(registro);
                } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
                    rowData.detalhamentoValue = generateClasseVIMemoriaCalculo(registro);
                } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
                    rowData.detalhamentoValue = generateClasseVIIMemoriaCalculo(registro);
                } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
                    rowData.detalhamentoValue = generateClasseVIIIMemoriaCalculo(registro);
                } else {
                    const isClasseII = ['Equipamento Individual', 'Proteção Balística', 'Material de Estacionamento'].includes(registro.categoria);
                    rowData.detalhamentoValue = generateClasseIIMemoriaCalculo(registro, isClasseII);
                }
            }
            
            // --- Renderização da Linha ---
            row.getCell('A').value = rowData.despesasValue;
            row.getCell('B').value = rowData.omValue;
            row.getCell('C').value = rowData.valorC > 0 ? rowData.valorC : '';
            row.getCell('D').value = rowData.valorD > 0 ? rowData.valorD : '';
            row.getCell('E').value = rowData.valorE > 0 ? rowData.valorE : '';
            row.getCell('F').value = rowData.litrosF;
            row.getCell('G').value = rowData.precoUnitarioG;
            row.getCell('H').value = rowData.precoTotalH;
            row.getCell('I').value = rowData.detalhamentoValue;
            
            // Estilos
            ['A', 'B'].forEach(col => {
                row.getCell(col).alignment = dataTextStyle;
                row.getCell(col).font = baseFontStyle;
                row.getCell(col).border = cellBorder;
            });
            
            ['C', 'D', 'E'].forEach(col => {
                const cell = row.getCell(col);
                cell.alignment = dataCenterMonetaryAlignment;
                cell.font = baseFontStyle;
                cell.border = cellBorder;
                cell.numFmt = 'R$ #,##0.00'; // Formato monetário
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
            });
            
            ['F', 'G', 'H'].forEach(col => {
                const cell = row.getCell(col);
                cell.alignment = dataCenterMonetaryAlignment;
                cell.font = baseFontStyle;
                cell.border = cellBorder;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
                if (col === 'H') {
                    cell.numFmt = 'R$ #,##0.00'; // Formato monetário
                }
            });
            
            row.getCell('I').alignment = leftTopAlignment;
            row.getCell('I').font = { name: 'Arial', size: 6.5 }; // Fonte menor para detalhamento
            row.getCell('I').border = cellBorder;
            
            currentRow++;
        });
        
        // Subtotal da OM
        const subtotalRow = worksheet.getRow(currentRow);
        subtotalRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        subtotalRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalRow.getCell('A').font = headerFontStyle;
        subtotalRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotal } };
        subtotalRow.getCell('A').border = cellBorder;
        
        subtotalRow.getCell('C').value = totaisOM.total_33_90_30;
        subtotalRow.getCell('C').alignment = dataCenterMonetaryAlignment;
        subtotalRow.getCell('C').font = headerFontStyle;
        subtotalRow.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('C').border = cellBorder;
        subtotalRow.getCell('C').numFmt = 'R$ #,##0.00';
        
        subtotalRow.getCell('D').value = totaisOM.total_33_90_39;
        subtotalRow.getCell('D').alignment = dataCenterMonetaryAlignment;
        subtotalRow.getCell('D').font = headerFontStyle;
        subtotalRow.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('D').border = cellBorder;
        subtotalRow.getCell('D').numFmt = 'R$ #,##0.00';
        
        subtotalRow.getCell('E').value = totaisOM.total_parte_azul;
        subtotalRow.getCell('E').alignment = dataCenterMonetaryAlignment;
        subtotalRow.getCell('E').font = headerFontStyle;
        subtotalRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('E').border = cellBorder;
        subtotalRow.getCell('E').numFmt = 'R$ #,##0.00';
        
        // Combustível (Apenas na RM) - CORRIGIDO: Remove a verificação 'isRM' e confia no valor > 0
        
        subtotalRow.getCell('F').value = totaisOM.totalDieselLitros > 0 ? `${formatNumber(totaisOM.totalDieselLitros)} L OD` : '';
        subtotalRow.getCell('F').alignment = dataCenterMiddleAlignment;
        subtotalRow.getCell('F').font = headerFontStyle;
        subtotalRow.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
        subtotalRow.getCell('F').border = cellBorder;
        
        subtotalRow.getCell('G').value = totaisOM.totalGasolinaLitros > 0 ? `${formatNumber(totaisOM.totalGasolinaLitros)} L GAS` : '';
        subtotalRow.getCell('G').alignment = dataCenterMiddleAlignment;
        subtotalRow.getCell('G').font = headerFontStyle;
        subtotalRow.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
        subtotalRow.getCell('G').border = cellBorder;
        
        subtotalRow.getCell('H').value = totaisOM.total_combustivel > 0 ? totaisOM.total_combustivel : '';
        subtotalRow.getCell('H').alignment = dataCenterMonetaryAlignment;
        subtotalRow.getCell('H').font = headerFontStyle;
        subtotalRow.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
        subtotalRow.getCell('H').border = cellBorder;
        subtotalRow.getCell('H').numFmt = 'R$ #,##0.00';
        
        subtotalRow.getCell('I').value = '';
        subtotalRow.getCell('I').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotal } };
        subtotalRow.getCell('I').border = cellBorder;
        
        currentRow++;
        
        // Total da OM
        const totalOMRow = worksheet.getRow(currentRow);
        totalOMRow.getCell('A').value = `VALOR TOTAL DO ${nomeOM}`;
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        totalOMRow.getCell('A').alignment = rightMiddleAlignment;
        totalOMRow.getCell('A').font = headerFontStyle;
        totalOMRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
        totalOMRow.getCell('A').border = cellBorder;
        
        totalOMRow.getCell('E').value = totaisOM.total_gnd3;
        totalOMRow.getCell('E').alignment = dataCenterMonetaryAlignment;
        totalOMRow.getCell('E').font = headerFontStyle;
        totalOMRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
        totalOMRow.getCell('E').border = cellBorder;
        totalOMRow.getCell('E').numFmt = 'R$ #,##0.00';
        
        worksheet.mergeCells(`F${currentRow}:I${currentRow}`);
        totalOMRow.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
        totalOMRow.getCell('F').border = cellBorder;
        
        currentRow++;
      });
      
      // Linha em branco para espaçamento
      currentRow++;
      
      // ========== TOTAL GERAL ==========
      
      // Linha 1: Soma detalhada por ND e GP de Despesa
      const totalGeralSomaRow = worksheet.getRow(currentRow);
      totalGeralSomaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      totalGeralSomaRow.getCell('A').alignment = rightMiddleAlignment;
      totalGeralSomaRow.getCell('A').font = headerFontStyle;
      totalGeralSomaRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotal } };
      totalGeralSomaRow.getCell('A').border = cellBorder;
      
      totalGeralSomaRow.getCell('C').value = totalGeral_33_90_30;
      totalGeralSomaRow.getCell('C').alignment = dataCenterMonetaryAlignment;
      totalGeralSomaRow.getCell('C').font = headerFontStyle;
      totalGeralSomaRow.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      totalGeralSomaRow.getCell('C').border = cellBorder;
      totalGeralSomaRow.getCell('C').numFmt = 'R$ #,##0.00';
      
      totalGeralSomaRow.getCell('D').value = totalGeral_33_90_39;
      totalGeralSomaRow.getCell('D').alignment = dataCenterMonetaryAlignment;
      totalGeralSomaRow.getCell('D').font = headerFontStyle;
      totalGeralSomaRow.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      totalGeralSomaRow.getCell('D').border = cellBorder;
      totalGeralSomaRow.getCell('D').numFmt = 'R$ #,##0.00';
      
      totalGeralSomaRow.getCell('E').value = totalGeral_GND3_ND;
      totalGeralSomaRow.getCell('E').alignment = dataCenterMonetaryAlignment;
      totalGeralSomaRow.getCell('E').font = headerFontStyle;
      totalGeralSomaRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      totalGeralSomaRow.getCell('E').border = cellBorder;
      totalGeralSomaRow.getCell('E').numFmt = 'R$ #,##0.00';
      
      // Totais de combustível por tipo (para exibição na parte laranja)
      // Usando as variáveis calculadas no useMemo
      const totalDieselLitrosGeral = totalDiesel;
      const totalGasolinaLitrosGeral = totalGasolina;
      const totalValorCombustivelFinalGeral = totalValorCombustivelFinal;
        
      totalGeralSomaRow.getCell('F').value = totalDieselLitrosGeral > 0 ? `${formatNumber(totalDieselLitrosGeral)} L OD` : '';
      totalGeralSomaRow.getCell('F').alignment = dataCenterMiddleAlignment;
      totalGeralSomaRow.getCell('F').font = headerFontStyle;
      totalGeralSomaRow.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      totalGeralSomaRow.getCell('F').border = cellBorder;
      
      totalGeralSomaRow.getCell('G').value = totalGasolinaLitrosGeral > 0 ? `${formatNumber(totalGasolinaLitrosGeral)} L GAS` : '';
      totalGeralSomaRow.getCell('G').alignment = dataCenterMiddleAlignment;
      totalGeralSomaRow.getCell('G').font = headerFontStyle;
      totalGeralSomaRow.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      totalGeralSomaRow.getCell('G').border = cellBorder;
      
      totalGeralSomaRow.getCell('H').value = totalValorCombustivelFinalGeral;
      totalGeralSomaRow.getCell('H').alignment = dataCenterMonetaryAlignment;
      totalGeralSomaRow.getCell('H').font = headerFontStyle;
      totalGeralSomaRow.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      totalGeralSomaRow.getCell('H').border = cellBorder;
      totalGeralSomaRow.getCell('H').numFmt = 'R$ #,##0.00';
      
      totalGeralSomaRow.getCell('I').value = '';
      totalGeralSomaRow.getCell('I').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotal } };
      totalGeralSomaRow.getCell('I').border = cellBorder;
      
      currentRow++;

      // Linha 2: Valor Total
      const totalGeralFinalRow = worksheet.getRow(currentRow);
      worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
      totalGeralFinalRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
      totalGeralFinalRow.getCell('A').border = cellBorder;
      
      totalGeralFinalRow.getCell('G').value = 'VALOR TOTAL';
      totalGeralFinalRow.getCell('G').alignment = centerMiddleAlignment;
      totalGeralFinalRow.getCell('G').font = headerFontStyle;
      totalGeralFinalRow.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
      totalGeralFinalRow.getCell('G').border = cellBorder;
      
      totalGeralFinalRow.getCell('H').value = valorTotalSolicitado;
      totalGeralFinalRow.getCell('H').alignment = dataCenterMonetaryAlignment;
      totalGeralFinalRow.getCell('H').font = headerFontStyle;
      totalGeralFinalRow.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
      totalGeralFinalRow.getCell('H').border = cellBorder;
      totalGeralFinalRow.getCell('H').numFmt = 'R$ #,##0.00';
      
      totalGeralFinalRow.getCell('I').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
      totalGeralFinalRow.getCell('I').border = cellBorder;
      
      currentRow++;
      
      // Linha 3: GND - 3 (dividida em 2 subdivisões)
      const gnd3Row1 = worksheet.getRow(currentRow);
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
      gnd3Row1.getCell('H').value = 'GND - 3';
      gnd3Row1.getCell('H').alignment = centerMiddleAlignment;
      gnd3Row1.getCell('H').font = headerFontStyle;
      gnd3Row1.getCell('H').border = { top: cellBorder.top, left: cellBorder.left, right: cellBorder.right };
      
      currentRow++;
      
      // Segunda subdivisão: Valor Total
      const gnd3Row2 = worksheet.getRow(currentRow);
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
      gnd3Row2.getCell('H').value = valorTotalSolicitado;
      gnd3Row2.getCell('H').alignment = dataCenterMonetaryAlignment;
      gnd3Row2.getCell('H').font = headerFontStyle;
      gnd3Row2.getCell('H').border = { bottom: cellBorder.bottom, left: cellBorder.left, right: cellBorder.right };
      gnd3Row2.getCell('H').numFmt = 'R$ #,##0.00';
      
      currentRow++;
      
      // Rodapé
      currentRow += 2;
      
      const localRow = worksheet.getRow(currentRow);
      localRow.getCell('A').value = `${ptrabData.local_om || 'Local'}, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      localRow.getCell('A').font = { name: 'Arial', size: 10 };
      localRow.getCell('A').alignment = centerMiddleAlignment;
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow += 3;
      
      const cmtRow = worksheet.getRow(currentRow);
      cmtRow.getCell('A').value = ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]';
      cmtRow.getCell('A').font = { name: 'Arial', size: 10, bold: true };
      cmtRow.getCell('A').alignment = centerMiddleAlignment;
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;
      
      const cargoRow = worksheet.getRow(currentRow);
      cargoRow.getCell('A').value = `Comandante da ${ptrabData.nome_om_extenso || ptrabData.nome_om}`;
      cargoRow.getCell('A').font = { name: 'Arial', size: 9 };
      cargoRow.getCell('A').alignment = centerMiddleAlignment;
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);

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
    } catch (error) {
      console.error("Erro ao gerar Excel:", error);
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível gerar o Excel. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [
    ptrabData, 
    diasOperacao, 
    totalGeral_33_90_30, 
    totalGeral_33_90_39, 
    totalValorCombustivelFinal, // Usando o total geral
    totalGeral_GND3_ND, // Adicionado explicitamente
    valorTotalSolicitado, 
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
    totalDiesel, // Adicionado para o useCallback
    totalGasolina, // Adicionado para o useCallback
  ]);


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
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado} militares do Exército Brasileiro</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS OPERACIONAIS:</p>
        </div>

        {omsOrdenadas.length > 0 ? (
          <div className="ptrab-table-wrapper">
            <table className="ptrab-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="col-despesas">DESPESAS</th> {/* ALTERADO AQUI */}
                  <th rowSpan={2} className="col-om">OM (UGE)<br/>CODUG</th>
                  <th colSpan={3} className="col-natureza-header">NATUREZA DE DESPESA</th>
                  <th colSpan={3} className="col-combustivel-header">COMBUSTÍVEL</th>
                  <th rowSpan={2} className="col-detalhamento">DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/>OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG</th>
                </tr>
                <tr>
                  <th className="col-nd" style={{ backgroundColor: '#B4C7E7' }}>33.90.30</th>
                  <th className="col-nd" style={{ backgroundColor: '#B4C7E7' }}>33.90.39</th>
                  <th className="col-nd" style={{ backgroundColor: '#B4C7E7' }}>TOTAL</th>
                  <th className="col-combustivel">LITROS</th>
                  <th className="col-combustivel">PREÇO<br/>UNITÁRIO</th>
                  <th className="col-combustivel">PREÇO<br/>TOTAL</th>
                </tr>
            </thead>
            <tbody>
              {[
                ...omsOrdenadas.flatMap((nomeOM, omIndex) => {
                  const grupo = gruposPorOM[nomeOM];
                  const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
                  
                  const isCombustivel = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';
                  
                  if (grupo.linhasQS.length === 0 && grupo.linhasQR.length === 0 && grupo.linhasClasseII.length === 0 && grupo.linhasClasseV.length === 0 && grupo.linhasClasseVI.length === 0 && grupo.linhasClasseVII.length === 0 && grupo.linhasClasseVIII.length === 0 && grupo.linhasClasseIX.length === 0 && grupo.linhasClasseIII.length === 0 && (nomeOM !== nomeRM || registrosClasseIII.filter(isCombustivel).length === 0)) {
                    return [];
                  }
                  
                  // Linhas de Classe III (Lubrificante e Combustível) - Ordenação interna
                  const linhasClasseIIIOrdenadas = grupo.linhasClasseIII.sort((a, b) => {
                      // Ordena Lubrificante antes de Combustível
                      if (a.tipo_suprimento === 'LUBRIFICANTE' && b.tipo_suprimento !== 'LUBRIFICANTE') return -1;
                      if (a.tipo_suprimento !== 'LUBRIFICANTE' && b.tipo_suprimento === 'LUBRIFICANTE') return 1;
                      
                      // Dentro de Combustível, ordena Diesel antes de Gasolina
                      if (a.tipo_suprimento === 'COMBUSTIVEL_DIESEL' && b.tipo_suprimento === 'COMBUSTIVEL_GASOLINA') return -1;
                      if (a.tipo_suprimento === 'COMBUSTIVEL_GASOLINA' && b.tipo_suprimento === 'COMBUSTIVEL_DIESEL') return 1;
                      
                      // Ordena por categoria de equipamento
                      return a.categoria_equipamento.localeCompare(b.categoria_equipamento);
                  });
                  
                  // NOVO: Array de todas as linhas de despesa na ordem correta (I, II, III, V-IX)
                  const allExpenseLines = [
                      ...grupo.linhasQS,
                      ...grupo.linhasQR,
                      ...grupo.linhasClasseII,
                      ...linhasClasseIIIOrdenadas, // CLASSE III INSERIDA AQUI
                      ...grupo.linhasClasseV,
                      ...grupo.linhasClasseVI,
                      ...grupo.linhasClasseVII,
                      ...grupo.linhasClasseVIII,
                      ...grupo.linhasClasseIX,
                  ];
                  
                  return [
                    // 1. Renderizar todas as linhas de despesa (I, II, III, V-IX)
                    ...allExpenseLines.map((linha, index) => {
                        // Type guards to determine the type of line
                        const isClasseI = 'tipo' in linha;
                        const isClasseIII = 'categoria_equipamento' in linha;
                        const isClasseII_IX = !isClasseI && !isClasseIII; // Must be LinhaClasseII

                        // ADICIONANDO VERIFICAÇÃO DE SEGURANÇA AQUI
                        if (!linha) return null;
                        
                        let rowData = {
                            despesasValue: '',
                            omValue: '',
                            detalhamentoValue: '',
                            valorC: 0,
                            valorD: 0,
                            valorE: 0,
                            litrosF: '',
                            precoUnitarioG: '',
                            precoTotalH: '',
                        };
                        
                        if (isClasseI) { // Classe I (QS/QR)
                            const registro = (linha as LinhaTabela).registro as ClasseIRegistro;
                            const tipo = (linha as LinhaTabela).tipo;
                            const ug_qs_formatted = formatCodug(registro.ug_qs);
                            const ug_qr_formatted = formatCodug(registro.ug);

                            if (tipo === 'QS') {
                                rowData.despesasValue = `CLASSE I - SUBSISTÊNCIA\n${registro.organizacao}`;
                                rowData.omValue = `${registro.om_qs}\n(${ug_qs_formatted})`;
                                rowData.valorC = registro.total_qs;
                                rowData.valorE = registro.total_qs;
                                rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QS');
                            } else { // QR
                                rowData.despesasValue = `CLASSE I - SUBSISTÊNCIA`;
                                rowData.omValue = `${registro.organizacao}\n(${ug_qr_formatted})`;
                                rowData.valorC = registro.total_qr;
                                rowData.valorE = registro.total_qr;
                                rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QR');
                            }
                        } else if (isClasseIII) { // Classe III (Combustível/Lubrificante)
                            const linhaClasseIII = linha as LinhaClasseIII;
                            const registro = linhaClasseIII.registro;
                            const isCombustivelLinha = linhaClasseIII.tipo_suprimento !== 'LUBRIFICANTE';
                            const isLubrificanteLinha = linhaClasseIII.tipo_suprimento === 'LUBRIFICANTE';
                            
                            // OM Detentora do Equipamento (Source)
                            const omDetentoraEquipamento = registro.organizacao;
                            
                            // 1ª Linha: CLASSE III - DIESEL/GASOLINA/LUBRIFICANTE
                            const tipoSuprimentoLabel = isLubrificanteLinha ? 'LUBRIFICANTE' : getTipoCombustivelLabel(linhaClasseIII.tipo_suprimento);
                            let despesasValue = `CLASSE III - ${tipoSuprimentoLabel}`;
                            
                            // 2ª Linha: CATEGORIA
                            const categoriaEquipamento = getTipoEquipamentoLabel(linhaClasseIII.categoria_equipamento);
                            despesasValue += `\n${categoriaEquipamento}`;
                            
                            // 3ª Linha: OM Detentora (se for necessário, ou seja, se for diferente da OM de destino do recurso)
                            const omDestinoRecurso = isCombustivelLinha ? nomeOM : (registro.om_detentora || registro.organizacao);
                            const isDifferentOm = omDetentoraEquipamento !== omDestinoRecurso;
                            
                            if (isDifferentOm) {
                                despesasValue += `\n${omDetentoraEquipamento}`;
                            }
                            
                            // OM (UGE) CODUG: OM de Destino do Recurso
                            const ugDestinoRecurso = isCombustivelLinha ? (registro.ug_detentora || '') : (registro.ug_detentora || registro.ug);
                            const ugDestinoFormatted = formatCodug(ugDestinoRecurso);
                            let omValue = `${omDestinoRecurso}\n(${ugDestinoFormatted})`;
                            
                            rowData.despesasValue = despesasValue;
                            rowData.omValue = omValue;
                            
                            if (isCombustivelLinha) {
                                rowData.valorC = 0;
                                rowData.valorD = 0;
                                rowData.valorE = 0;
                                
                                rowData.litrosF = `${formatNumber(linhaClasseIII.total_litros_linha)} L`;
                                rowData.precoUnitarioG = formatCurrency(linhaClasseIII.preco_litro_linha);
                                rowData.precoTotalH = formatCurrency(linhaClasseIII.valor_total_linha);
                                
                            } else if (isLubrificanteLinha) {
                                rowData.valorC = linhaClasseIII.valor_total_linha;
                                rowData.valorD = 0;
                                rowData.valorE = linhaClasseIII.valor_total_linha;
                                
                                rowData.litrosF = '';
                                rowData.precoUnitarioG = '';
                                rowData.precoTotalH = '';
                            }
                            
                            rowData.detalhamentoValue = generateClasseIIIMemoriaCalculo(registro);
                            
                        } else if (isClasseII_IX) { // Classe II, V, VI, VII, VIII, IX
                            const registro = (linha as LinhaClasseII).registro as ClasseIIRegistro;
                            const omDestinoRecurso = registro.organizacao;
                            const ugDestinoRecurso = formatCodug(registro.ug);
                            
                            let categoriaDetalhe = getClasseIILabel(registro.categoria); // Usar rótulo completo
                            
                            if (registro.categoria === 'Remonta/Veterinária' && registro.animal_tipo) {
                                categoriaDetalhe = registro.animal_tipo;
                            }
                                
                            const omDetentora = registro.om_detentora || omDestinoRecurso;
                            const isDifferentOm = omDetentora !== omDestinoRecurso;
                            
                            // 1. Define o prefixo CLASSE X
                            let prefixoClasse = '';
                            if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
                                prefixoClasse = 'CLASSE V';
                            } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
                                prefixoClasse = 'CLASSE VI';
                            } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
                                prefixoClasse = 'CLASSE VII';
                            } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
                                prefixoClasse = 'CLASSE VIII';
                            } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                                prefixoClasse = 'CLASSE IX';
                            } else {
                                prefixoClasse = 'CLASSE II';
                            }
                            
                            rowData.despesasValue = `${prefixoClasse} - ${categoriaDetalhe.toUpperCase()}`;
                            
                            // 2. Adiciona a OM Detentora se for diferente da OM de Destino
                            if (isDifferentOm) {
                                rowData.despesasValue += `\n${omDetentora}`;
                            }
                            
                            rowData.omValue = `${omDestinoRecurso}\n(${ugDestinoRecurso})`;
                            rowData.valorC = registro.valor_nd_30;
                            rowData.valorD = registro.valor_nd_39;
                            rowData.valorE = registro.valor_nd_30 + registro.valor_nd_39;
                            
                            // 3. Prioriza o detalhamento customizado ou usa a função de memória unificada
                            if (registro.detalhamento_customizado) {
                                rowData.detalhamentoValue = registro.detalhamento_customizado;
                            } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                                rowData.detalhamentoValue = generateClasseIXMemoriaCalculo(registro);
                            } else if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
                                rowData.detalhamentoValue = generateClasseVMemoriaCalculo(registro);
                            } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
                                rowData.detalhamentoValue = generateClasseVIMemoriaCalculo(registro);
                            } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
                                rowData.detalhamentoValue = generateClasseVIIMemoriaCalculo(registro);
                            } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
                                rowData.detalhamentoValue = generateClasseVIIIMemoriaCalculo(registro);
                            } else {
                                const isClasseII = ['Equipamento Individual', 'Proteção Balística', 'Material de Estacionamento'].includes(registro.categoria);
                                rowData.detalhamentoValue = generateClasseIIMemoriaCalculo(registro, isClasseII);
                            }
                        }
                        
                        return (
                            <tr key={`${nomeOM}-expense-${index}`} className="expense-row">
                                <td className="col-despesas">
                                    {rowData.despesasValue.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                                </td>
                                <td className="col-om">
                                    {rowData.omValue.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                                </td>
                                <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}>{rowData.valorC > 0 ? formatCurrency(rowData.valorC) : ''}</td>
                                <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}>{rowData.valorD > 0 ? formatCurrency(rowData.valorD) : ''}</td>
                                <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}>{rowData.valorE > 0 ? formatCurrency(rowData.valorE) : ''}</td>
                                <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}>{rowData.litrosF}</td>
                                <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}>{rowData.precoUnitarioG}</td>
                                <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}>{rowData.precoTotalH}</td>
                                <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                                    <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                        {rowData.detalhamentoValue}
                                    </pre>
                                </td>
                            </tr>
                        );
                    }),
                    
                    // Subtotal da OM
                    <tr key={`${nomeOM}-subtotal`} className="subtotal-row">
                      <td colSpan={2} className="text-right font-bold">SOMA POR ND E GP DE DESPESA</td>
                      {/* Parte Azul (Natureza de Despesa) */}
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totaisOM.total_33_90_30)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totaisOM.total_33_90_39)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totaisOM.total_parte_azul)}</td> {/* TOTAL ND (C+D) */}
                      {/* Parte Laranja (Combustivel) - CORRIGIDO: Remove a verificação nomeOM === nomeRM */}
                      <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
                        {totaisOM.totalDieselLitros > 0 
                          ? `${formatNumber(totaisOM.totalDieselLitros)} L OD` 
                          : ''}
                      </td>
                      <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
                        {totaisOM.totalGasolinaLitros > 0 
                          ? `${formatNumber(totaisOM.totalGasolinaLitros)} L GAS` 
                          : ''}
                      </td>
                      <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
                        {totaisOM.total_combustivel > 0 
                          ? formatCurrency(totaisOM.total_combustivel) 
                          : ''}
                      </td>
                      <td></td>
                    </tr>,
                    
                    // Total da OM
                    <tr key={`${nomeOM}-total`} className="subtotal-om-row">
                      <td colSpan={4} className="text-right font-bold">
                        VALOR TOTAL DO {nomeOM}
                      </td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#E8E8E8' }}>{formatCurrency(totaisOM.total_gnd3)}</td>
                      <td colSpan={3}></td>
                      <td></td>
                    </tr>
                  ];
                }),
                
                // Linha em branco para espaçamento
                <tr key="spacing-row" className="spacing-row">
                  <td colSpan={9} style={{ height: '20px', border: 'none', backgroundColor: 'transparent', borderLeft: 'none', borderRight: 'none' }}></td>
                </tr>,
                
                // ========== TOTAL GERAL ==========
                ...(() => {
                  // Totais de combustível por tipo (para exibição na parte laranja)
                  // Usando os totais gerais calculados no useMemo
                  const totalDieselLitrosGeral = totalDiesel;
                  const totalGasolinaLitrosGeral = totalGasolina;
                  const totalValorCombustivelFinalGeral = totalValorCombustivelFinal;

                  return [
                    // Linha 1: Soma detalhada por ND e GP de Despesa
                    <tr key="total-geral-soma-row" className="total-geral-soma-row">
                      <td colSpan={2} className="text-right font-bold">SOMA POR ND E GP DE DESPESA</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totalGeral_33_90_30)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totalGeral_33_90_39)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totalGeral_GND3_ND)}</td>
                      {/* F: LITROS DIESEL */}
                      <td className="text-center font-bold" style={{ backgroundColor: '#F8CBAD' }}>{totalDieselLitrosGeral > 0 ? `${formatNumber(totalDieselLitrosGeral)} L OD` : ''}</td>
                      {/* G: LITROS GASOLINA */}
                      <td className="text-center font-bold" style={{ backgroundColor: '#F8CBAD' }}>{totalGasolinaLitrosGeral > 0 ? `${formatNumber(totalGasolinaLitrosGeral)} L GAS` : ''}</td>
                      {/* H: PREÇO TOTAL COMBUSTÍVEL */}
                      <td className="text-center font-bold" style={{ backgroundColor: '#F8CBAD' }}>{totalValorCombustivelFinalGeral > 0 ? formatCurrency(totalValorCombustivelFinalGeral) : ''}</td>
                      <td style={{ backgroundColor: '#D3D3D3' }}></td>
                    </tr>,

                    // Linha 2: Valor Total
                    <tr key="total-geral-final-row" className="total-geral-final-row">
                      <td colSpan={6} className="text-right font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000', borderRight: 'none' }}>
                        VALOR TOTAL
                      </td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}>{formatCurrency(valorTotalSolicitado)}</td>
                      <td colSpan={2} style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}></td>
                    </tr>,
                    
                    // Linha 3: GND - 3 (dividida em 2 subdivisões)
                    <tr key="gnd3-row-1" style={{ backgroundColor: 'white' }}>
                      <td colSpan={7} style={{ border: 'none' }}></td>
                      <td className="text-center font-bold" style={{ borderLeft: '1px solid #000', borderTop: '1px solid #000', borderRight: '1px solid #000' }}>GND - 3</td>
                      <td style={{ border: 'none' }}></td>
                    </tr>,
                    
                    // Segunda subdivisão: Valor Total
                    <tr key="gnd3-row-2" style={{ backgroundColor: 'white' }}>
                      <td colSpan={7} style={{ border: 'none' }}></td>
                      <td className="text-center font-bold" style={{ borderLeft: '1px solid #000', borderBottom: '1px solid #000', borderRight: '1px solid #000' }}>{formatCurrency(valorTotalSolicitado)}</td>
                      <td style={{ border: 'none' }}></td>
                    </tr>
                  ];
                })(),
              ]}
            </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Nenhum registro logístico cadastrado.</p>
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
        .ptrab-print-container { max-width: 100%; margin: 0 auto; padding: 2rem 1rem; font-family: Arial, sans-serif; }
        .ptrab-header { text-align: center; margin-bottom: 1.5rem; line-height: 1.4; }
        .ptrab-header p { font-size: 11pt; } /* Tamanho de fonte fixo */
        .ptrab-info { margin-bottom: 0.3rem; font-size: 10pt; line-height: 1.3; }
          .info-item { margin-bottom: 0.15rem; }
        .ptrab-table-wrapper { margin-top: 0.2rem; margin-bottom: 2rem; overflow-x: auto; }
        .ptrab-table { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; line-height: 1.1; }
        .ptrab-table th, .ptrab-table td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; font-size: 8pt; } /* Fonte de dados reduzida para 8pt */
        .ptrab-table thead th { background-color: #E8E8E8; font-weight: bold; text-align: center; font-size: 9pt; }
        
        /* LARGURAS DE COLUNA FIXAS */
        .col-despesas { width: 14%; text-align: left; }
        .col-om { width: 9%; text-align: center; }
        .col-natureza-header { background-color: #B4C7E7 !important; text-align: center; font-weight: bold; }
        .col-natureza { background-color: #B4C7E7 !important; width: 8%; text-align: center; }
        .col-nd { width: 8%; text-align: center; }
        .col-combustivel-header { background-color: #F8CBAD !important; text-align: center; font-weight: bold; }
        .col-combustivel { background-color: #F8CBAD !important; width: 6%; text-align: center; font-size: 8pt; }
        .col-combustivel-data { background-color: #FFF; text-align: center; width: 6%; }
        .col-valor-natureza { background-color: #B4C7E7 !important; text-align: center; padding: 6px 8px; }
        .col-combustivel-data-filled { background-color: #F8CBAD !important; text-align: center; padding: 6px 8px; }
        .col-detalhamento { width: 28%; text-align: left; }
        
        .subtotal-row, .subtotal-om-row, .total-geral-soma-row, .total-geral-final-row { 
            font-weight: bold; 
            page-break-inside: avoid; /* Previne quebra */
        } 
        .subtotal-row { background-color: #D3D3D3; }
        .subtotal-om-row { background-color: #E8E8E8; }
        .total-geral-soma-row { background-color: #D3D3D3; border-top: 1px solid #000; }
        .total-geral-final-row { background-color: #E8E8E8; }
        
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; }
        
        /* REGRAS ESPECÍFICAS DE IMPRESSÃO (CORREÇÃO DE ALINHAMENTO) */
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .ptrab-print-container { padding: 0 !important; margin: 0 !important; }
          .ptrab-table thead { display: table-row-group; break-inside: avoid; break-after: auto; }
          .ptrab-table th, .ptrab-table td { border: 0.25pt solid #000 !important; } /* Borda mais fina para impressão */
          .ptrab-table { border: 0.25pt solid #000 !important; }
          
          /* CORREÇÃO CRÍTICA: Força alinhamento vertical middle para as colunas de dados A a H */
          .expense-row td:nth-child(1), /* Coluna A: DESPESAS */
          .expense-row td:nth-child(2), /* Coluna B: OM/CODUG */
          .expense-row td:nth-child(3), /* Coluna C: 33.90.30 */
          .expense-row td:nth-child(4), /* Coluna D: 33.90.39 */
          .expense-row td:nth-child(5), /* Coluna E: TOTAL ND */
          .expense-row td:nth-child(6), /* Coluna F: LITROS */
          .expense-row td:nth-child(7), /* Coluna G: PREÇO UNITÁRIO */
          .expense-row td:nth-child(8) { /* Coluna H: PREÇO TOTAL */
              vertical-align: middle !important;
          }
          
          /* Coluna I (Detalhamento) deve ser top */
          .expense-row .col-detalhamento {
              vertical-align: top !important;
          }
          
          /* Garante que as cores de fundo sejam impressas */
          .subtotal-row td, .total-geral-soma-row td, .total-geral-final-row td,
          .col-valor-natureza, .col-combustivel-data-filled {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          
          .print-avoid-break {
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* REMOVIDO: AlertDialog */}
    </div>
  );
};

export default PTrabLogisticoReport;