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
import { 
  generateRacaoQuenteMemoriaCalculo, 
  generateRacaoOperacionalMemoriaCalculo,
  calculateClasseICalculations,
  ClasseIRegistro as ClasseIRegistroType, // Importando o tipo correto
} from "@/lib/classeIUtils"; // Importando as funções de utilidade
import { generateClasseIIMemoriaCalculo as generateClasseIIUtility } from "@/lib/classeIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVUtility } from "@/lib/classeVUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIUtility } from "@/lib/classeVIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIIUtility } from "@/lib/classeVIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIIIUtility } from "@/lib/classeVIIIUtils"; // NOVO: Importando utilitário de Classe VIII
import { generateCategoryMemoriaCalculo as generateClasseIXUtility, calculateItemTotalClasseIX as calculateItemTotalClasseIXUtility } from "@/lib/classeIXUtils"; // NOVO: Importando utilitário de Classe IX
import { generateGranularMemoriaCalculo as generateClasseIIIGranularUtility, calculateItemTotals } from "@/lib/classeIIIUtils"; // NOVO: Importando utilitário granular da Classe III
import { RefLPC } from "@/types/refLPC"; // NOVO: Importando tipo RefLPC
import { fetchDiretrizesOperacionais } from "@/lib/ptrabUtils"; // Importando a função simplificada
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear"; // NOVO HOOK

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

// Usando o tipo importado para garantir consistência
export type ClasseIRegistro = ClasseIRegistroType;

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
  tipo: 'QS' | 'QR';
  valor_nd_30: number; // Adicionado para consistência
  valor_nd_39: number; // Adicionado para consistência
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
  linhasClasseIII: LinhaClasseIII[]; // NOVO: Linhas desagregadas de Classe III
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
 * Esta função é a única responsável por gerar a memória de cálculo de Classe I para relatórios.
 */
export const generateClasseIMemoriaCalculoUnificada = (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP'): string => {
    if (registro.categoria === 'RACAO_OPERACIONAL') {
        if (tipo === 'OP') {
            // CORREÇÃO APLICADA AQUI: Usar o campo dedicado memoria_calculo_op_customizada
            if (registro.memoria_calculo_op_customizada && registro.memoria_calculo_op_customizada.trim().length > 0) {
                return registro.memoria_calculo_op_customizada;
            }
            
            // 2. Se não houver customizado, gera o automático
            return generateRacaoOperacionalMemoriaCalculo({
                id: registro.id,
                organizacao: registro.organizacao,
                ug: registro.ug,
                diasOperacao: registro.dias_operacao,
                faseAtividade: registro.fase_atividade,
                efetivo: registro.efetivo,
                quantidadeR2: registro.quantidade_r2,
                quantidadeR3: registro.quantidade_r3,
                // Campos não utilizados na memória OP, mas necessários para a interface
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
 * Função para gerar a memória de cálculo da Classe III (Combustível/Lubrificante)
 * no nível granular (o mesmo nível de detalhe da edição do usuário).
 */
export const generateClasseIIIMemoriaCalculo = (registro: ClasseIIIRegistro, refLPC: RefLPC | null): string => {
    const itens = registro.itens_equipamentos || [];
    
    // 1. Se for Combustível, a memória é granular por item e tipo de combustível.
    if (registro.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO') {
        
        let finalMemoria = "";
        
        // Agrupar itens por tipo de combustível (Diesel/Gasolina)
        const gruposPorCombustivel = itens.reduce((grupos, item) => {
            const tipo = item.tipo_combustivel_fixo;
            if (!grupos[tipo]) grupos[tipo] = [];
            grupos[tipo].push(item);
            return grupos;
        }, {} as Record<'GASOLINA' | 'DIESEL', ItemClasseIII[]>);
        
        Object.entries(gruposPorCombustivel).forEach(([tipoCombustivel, itensGrupo]) => {
            itensGrupo.forEach(item => {
                // 1. Tenta usar a memória customizada do item
                if (item.memoria_customizada && item.memoria_customizada.trim().length > 0) {
                    finalMemoria += item.memoria_customizada + "\n\n";
                    return;
                }
                
                // 2. Se não houver customizada, gera a automática granular
                const suprimento_tipo = item.tipo_combustivel_fixo === 'GASOLINA' ? 'COMBUSTIVEL_GASOLINA' : 'COMBUSTIVEL_DIESEL';
                
                const granularItem: GranularDisplayItem = {
                    id: `${registro.id}-${item.item}-${suprimento_tipo}`,
                    om_destino: registro.organizacao,
                    ug_destino: registro.ug,
                    categoria: item.categoria,
                    suprimento_tipo: suprimento_tipo,
                    valor_total: 0, // Será recalculado dentro da função utilitária
                    total_litros: 0, // Será recalculado dentro da função utilitária
                    preco_litro: registro.preco_litro,
                    dias_operacao: registro.dias_operacao,
                    fase_atividade: registro.fase_atividade || '',
                    valor_nd_30: registro.valor_nd_30,
                    valor_nd_39: registro.valor_nd_39,
                    original_registro: registro,
                    detailed_items: [item], // Passa apenas o item granular
                };
                
                // Para Combustível, a OM Destino Recurso é a RM de Fornecimento (om_detentora/ug_detentora)
                const rmFornecimento = registro.om_detentora || '';
                const codugRmFornecimento = registro.ug_detentora || '';
                
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
        // 2. Se for Lubrificante, a memória é granular por CATEGORIA (Gerador/Embarcação)
        
        // Agrupar itens por categoria (Gerador/Embarcação)
        const gruposPorCategoria = itens.reduce((grupos, item) => {
            const categoria = item.categoria;
            if (!grupos[categoria]) grupos[categoria] = [];
            grupos[categoria].push(item);
            return grupos;
        }, {} as Record<'GERADOR' | 'EMBARCACAO', ItemClasseIII[]>);
        
        let finalMemoria = "";
        
        Object.entries(gruposPorCategoria).forEach(([categoria, itensGrupo]) => {
            // 1. Tenta usar a memória customizada do primeiro item do grupo (se houver)
            const itemComMemoria = itensGrupo.find(i => !!i.memoria_customizada) || itensGrupo[0];
            if (itemComMemoria && itemComMemoria.memoria_customizada && itemComMemoria.memoria_customizada.trim().length > 0) {
                finalMemoria += itemComMemoria.memoria_customizada + "\n\n";
                return;
            }
            
            // 2. Se não houver customizada, gera a automática granular
            
            // Para Lubrificante, a OM Destino Recurso é a om_detentora/ug_detentora
            const omDestinoRecurso = registro.om_detentora || '';
            const ugDestinoRecurso = registro.ug_detentora || '';
            
            // Criar um item granular que representa o grupo de lubrificante daquela categoria
            const granularItem: GranularDisplayItem = {
                id: `${registro.id}-${categoria}-LUBRIFICANTE`,
                om_destino: registro.organizacao, // OM Detentora do Equipamento
                ug_destino: registro.ug, // UG Detentora do Equipamento
                categoria: categoria as any,
                suprimento_tipo: 'LUBRIFICANTE',
                valor_total: registro.valor_total, // Usamos o total do registro consolidado
                total_litros: registro.total_litros, // Usamos o total de litros do registro consolidado
                preco_litro: 0, // Não aplicável / Preço médio
                dias_operacao: registro.dias_operacao,
                fase_atividade: registro.fase_atividade || '',
                valor_nd_30: registro.valor_nd_30,
                valor_nd_39: registro.valor_nd_39,
                original_registro: registro,
                detailed_items: itensGrupo, // Passa todos os itens da categoria
            };
            
            finalMemoria += generateClasseIIIGranularUtility(
                granularItem, 
                refLPC, 
                omDestinoRecurso, 
                ugDestinoRecurso
            ) + "\n\n";
        });
        
        return finalMemoria.trim();
    }
    
    // Fallback para o detalhamento consolidado (se não for Combustível/Lubrificante)
    return registro.detalhamento || "Memória de cálculo não disponível.";
};


/**
 * Função unificada para gerar a memória de cálculo da Classe II, V, VI, VII, VIII e IX,
 * priorizando o customizado e usando os utilitários corretos.
 */
export const generateClasseIIMemoriaCalculo = (registro: ClasseIIRegistro, isClasseII: boolean): string => {
    // 0. Verificação de segurança
    if (!registro || !registro.categoria) {
        return "Registro inválido ou categoria ausente.";
    }
    
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
      return registro.detalhamento_customizado;
    }
    
    if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
        return generateClasseIXMemoriaCalculo(registro);
    }
    
    if (isClasseII) {
        // Se for Classe II (Intendência), usa o utilitário atualizado
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
    
    // NOVO: Lógica para Classe VIII
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

// =================================================================
// FUNÇÕES AUXILIARES DE RÓTULO
// =================================================================

export const getTipoCombustivelLabel = (tipo: string) => {
    if (tipo === 'DIESEL' || tipo === 'OD' || tipo === 'COMBUSTIVEL_DIESEL') {
        return 'DIESEL'; // Alterado de 'ÓLEO DIESEL' para 'DIESEL'
    } else if (tipo === 'GASOLINA' || tipo === 'GAS' || tipo === 'COMBUSTIVEL_GASOLINA') {
        return 'GASOLINA';
    }
    return tipo;
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
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null); // NOVO: Estado para RefLPC
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportType>('logistico');

  const isLubrificante = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
  const isCombustivel = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';
  
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
        // CORRIGIDO: Incluindo o campo dedicado memoria_calculo_op_customizada
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
        { data: refLPCData }, // NOVO: Carregar RefLPC
      ] = await Promise.all([
        supabase.from('classe_ii_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora, efetivo').eq('p_trab_id', ptrabId),
        supabase.from('classe_v_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora, efetivo').eq('p_trab_id', ptrabId),
        supabase.from('classe_vi_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora').eq('p_trab_id', ptrabId),
        supabase.from('classe_vii_registros').select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora').eq('p_trab_id', ptrabId),
        supabase.from('classe_viii_saude_registros').select('*, itens_saude, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora, efetivo').eq('p_trab_id', ptrabId),
        supabase.from('classe_viii_remonta_registros').select('*, itens_remonta, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, animal_tipo, quantidade_animais, om_detentora, ug_detentora, efetivo').eq('p_trab_id', ptrabId),
        supabase.from('classe_ix_registros').select('*, itens_motomecanizacao, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, om_detentora, ug_detentora').eq('p_trab_id', ptrabId),
        supabase.from('classe_iii_registros').select('*, detalhamento_customizado, itens_equipamentos, fase_atividade, consumo_lubrificante_litro, preco_lubrificante, valor_nd_30, valor_nd_39, om_detentora, ug_detentora').eq('p_trab_id', ptrabId),
        supabase.from("p_trab_ref_lpc").select("*").eq("p_trab_id", ptrabId).maybeSingle(), // NOVO: Carregar RefLPC
      ]);

      const allClasseItems = [
        ...(classeIIData || []).map(r => ({ ...r, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo })),
        ...(classeVData || []).map(r => ({ ...r, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo })),
        ...(classeVIData || []).map(r => ({ ...r, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo })),
        ...(classeVIIData || []).map(r => ({ ...r, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo })),
        // Mapeamento de Classe VIII Saúde: itens_saude -> itens_equipamentos
        ...(classeVIIISaudeData || []).map(r => ({ ...r, itens_equipamentos: r.itens_saude, categoria: 'Saúde', om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo })),
        // Mapeamento de Classe VIII Remonta: itens_remonta -> itens_equipamentos
        ...(classeVIIIRemontaData || []).map(r => ({ ...r, itens_equipamentos: r.itens_remonta, categoria: 'Remonta/Veterinária', animal_tipo: r.animal_tipo, quantidade_animais: r.quantidade_animais, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo })),
        ...(classeIXData || []).map(r => ({ ...r, itens_equipamentos: r.itens_motomecanizacao, categoria: r.categoria, om_detentora: r.om_detentora, ug_detentora: r.ug_detentora, efetivo: r.efetivo })),
      ];

      setPtrabData(ptrab as PTrabData); // Casting para incluir updated_at
      setRegistrosClasseI((classeIData || []).map(r => ({
          ...r,
          // Mapeamento explícito de campos do DB (snake_case) para o tipo TS (camelCase)
          id: r.id,
          organizacao: r.organizacao,
          ug: r.ug,
          diasOperacao: r.dias_operacao,
          faseAtividade: r.fase_atividade,
          omQS: r.om_qs,
          ugQS: r.ug_qs,
          efetivo: r.efetivo,
          nrRefInt: r.nr_ref_int,
          valorQS: Number(r.valor_qs),
          valorQR: Number(r.valor_qr),
          complemento_qs: Number(r.complemento_qs),
          etapa_qs: Number(r.etapa_qs),
          total_qs: Number(r.total_qs),
          complemento_qr: Number(r.complemento_qr),
          etapa_qr: Number(r.etapa_qr),
          total_geral: Number(r.total_geral),
          memoriaQSCustomizada: r.memoria_calculo_qs_customizada,
          memoriaQRCustomizada: r.memoria_calculo_qr_customizada,
          // CORRIGIDO: Mapeamento do campo dedicado
          memoria_calculo_op_customizada: r.memoria_calculo_op_customizada, 
          categoria: (r.categoria || 'RACAO_QUENTE') as 'RACAO_QUENTE' | 'RACAO_OPERACIONAL',
          quantidade_r2: r.quantidade_r2 || 0,
          quantidade_r3: r.quantidade_r3 || 0,
          calculos: calculateClasseICalculations(r.efetivo, r.dias_operacao, r.nr_ref_int || 0, Number(r.valor_qs), Number(r.valor_qr)),
      })) as ClasseIRegistro[]);
      setRegistrosClasseII(allClasseItems as ClasseIIRegistro[]);
      setRegistrosClasseIII(classeIIIData || []);
      setRefLPC(refLPCData as RefLPC || null); // NOVO: Salvar RefLPC
      
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
                linhasClasseIII: [] // Inicializa a nova lista
            };
        }
    };

    // 1. Processar Classe I (Apenas Ração Quente para a tabela principal)
    registrosClasseI.filter(r => r.categoria === 'RACAO_QUENTE').forEach((registro) => {
        initializeGroup(registro.om_qs || registro.organizacao); // Usa OM QS como chave de destino
        grupos[registro.om_qs || registro.organizacao].linhasQS.push({ 
            registro, 
            tipo: 'QS',
            valor_nd_30: registro.total_qs,
            valor_nd_39: 0,
        });
        
        initializeGroup(registro.organizacao); // Usa OM de destino (QR) como chave de destino
        grupos[registro.organizacao].linhasQR.push({ 
            registro, 
            tipo: 'QR',
            valor_nd_30: registro.total_qr,
            valor_nd_39: 0,
        });
    });
    
    // 2. Processar Classes II, V, VI, VII, VIII, IX
    registrosClasseII.forEach((registro) => {
        // A chave de agrupamento é a OM de DESTINO do recurso (campo 'organizacao' no DB)
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

    // 3. Processar Classe III (Combustível e Lubrificante) - DESAGREGAÇÃO
    registrosClasseIII.forEach((registro) => {
        const isCombustivel = registro.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';
        const isLubrificante = registro.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
        
        if (isCombustivel || isLubrificante) {
            // A OM de destino do recurso (RM para Combustível, OM Detentora para Lubrificante)
            const omDestinoRecurso = registro.om_detentora || registro.organizacao;
            initializeGroup(omDestinoRecurso);
            
            const itens = registro.itens_equipamentos || [];
            
            // Agrupamento por Categoria de Equipamento (para Lubrificante) ou Tipo de Combustível (para Combustível)
            const gruposGranulares: Record<string, ItemClasseIII[]> = {};
            
            // Agrupa por Categoria de Equipamento (Gerador, Embarcação, etc.)
            itens.forEach(item => {
                const key = item.categoria;
                if (!gruposGranulares[key]) gruposGranulares[key] = [];
                gruposGranulares[key].push(item);
            });
            
            // Cria uma LinhaClasseIII para cada grupo granular
            Object.entries(gruposGranulares).forEach(([categoriaKey, itensGrupo]) => {
                if (itensGrupo.length === 0) return;
                
                const primeiroItem = itensGrupo[0];
                
                // Recalcular totais para esta linha granular
                let totalLitrosLinha = 0;
                let valorTotalLinha = 0;
                let precoLitroLinha = 0;
                
                itensGrupo.forEach(item => {
                    const totals = calculateItemTotals(item, refLPC, registro.dias_operacao);
                    if (isCombustivel) {
                        // Combustível: Agrupa por tipo de combustível (Diesel/Gasolina)
                        if (item.tipo_combustivel_fixo === registro.tipo_combustivel) {
                            totalLitrosLinha += totals.totalLitros;
                            valorTotalLinha += totals.valorCombustivel;
                            precoLitroLinha = totals.precoLitro; // Preço é o mesmo para o tipo de combustível
                        }
                    } else if (isLubrificante) {
                        // Lubrificante: Agrupa por categoria (Gerador/Embarcação)
                        totalLitrosLinha += totals.litrosLubrificante;
                        valorTotalLinha += totals.valorLubrificante;
                        // Para Lubrificante, o preço unitário é o preço médio (valor total / litros)
                        precoLitroLinha = totalLitrosLinha > 0 ? valorTotalLinha / totalLitrosLinha : 0;
                    }
                });
                
                // Se o valor total for zero, ignora a linha (pode acontecer se o item for de outro tipo de combustível no registro consolidado)
                if (valorTotalLinha === 0) return;

                const tipoSuprimento: LinhaClasseIII['tipo_suprimento'] = isCombustivel 
                    ? (primeiroItem.tipo_combustivel_fixo === 'GASOLINA' ? 'COMBUSTIVEL_GASOLINA' : 'COMBUSTIVEL_DIESEL')
                    : 'LUBRIFICANTE';
                
                // Gerar a memória de cálculo para esta linha granular
                let memoriaCalculo = "";
                
                // Para Combustível, a OM Destino Recurso é a RM de Fornecimento (om_detentora/ug_detentora)
                const omDestinoCombustivel = registro.om_detentora || '';
                const ugDestinoCombustivel = registro.ug_detentora || '';
                
                // Para Lubrificante, a OM Destino Recurso é a om_detentora/ug_detentora
                const omDestinoLubrificante = registro.om_detentora || '';
                const ugDestinoLubrificante = registro.ug_detentora || '';
                
                // Criar o item granular para a função de memória
                const granularItem: GranularDisplayItem = {
                    id: `${registro.id}-${categoriaKey}-${tipoSuprimento}`,
                    om_destino: registro.organizacao, // OM Detentora do Equipamento
                    ug_destino: registro.ug, // UG Detentora do Equipamento
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
                    detailed_items: itensGrupo,
                };
                
                // Tenta usar a memória customizada do primeiro item do grupo (se houver)
                const itemComMemoria = itensGrupo.find(i => !!i.memoria_customizada) || itensGrupo[0];
                if (itemComMemoria && itemComMemoria.memoria_customizada && itemComMemoria.memoria_customizada.trim().length > 0) {
                    memoriaCalculo = itemComMemoria.memoria_customizada;
                } else {
                    // Gera a memória automática granular
                    memoriaCalculo = generateClasseIIIGranularUtility(
                        granularItem, 
                        refLPC, 
                        isCombustivel ? omDestinoCombustivel : omDestinoLubrificante, 
                        isCombustivel ? ugDestinoCombustivel : ugDestinoLubrificante
                    );
                }
                
                // Adiciona a linha desagregada ao grupo da OM de destino do recurso
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
    const oms = Object.keys(gruposPorOM);
    return oms.find(om => om.includes('RM') || om.includes('R M')) || ptrabData?.rm_vinculacao || '';
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
    
    // NOVO: Total Lubrificante (agora vem das linhas desagregadas)
    const totalLubrificante = grupo.linhasClasseIII
        .filter(l => l.tipo_suprimento === 'LUBRIFICANTE')
        .reduce((acc, linha) => acc + linha.valor_total_linha, 0);
    
    const total_33_90_30 = totalQS + totalQR + 
                           totalClasseII_ND30 + totalClasseV_ND30 + totalClasseVI_ND30 + totalClasseVII_ND30 + totalClasseVIII_ND30 + totalClasseIX_ND30 +
                           totalLubrificante; 
    
    const total_33_90_39 = totalClasseII_ND39 + totalClasseV_ND39 + totalClasseVI_ND39 + totalClasseVII_ND39 + totalClasseVIII_ND39 + totalClasseIX_ND39;
    
    const total_parte_azul = total_33_90_30 + total_33_90_39;
    
    // Combustível (Apenas na RM)
    const combustivelDestaRM = (nomeOM === nomeRM) 
      ? grupo.linhasClasseIII.filter(l => l.tipo_suprimento === 'COMBUSTIVEL_DIESEL' || l.tipo_suprimento === 'COMBUSTIVEL_GASOLINA')
      : [];
    
    const valorDiesel = combustivelDestaRM
      .filter(l => l.tipo_suprimento === 'COMBUSTIVEL_DIESEL')
      .reduce((acc, l) => acc + l.valor_total_linha, 0);
    const valorGasolina = combustivelDestaRM
      .filter(l => l.tipo_suprimento === 'COMBUSTIVEL_GASOLINA')
      .reduce((acc, l) => acc + l.valor_total_linha, 0);
    
    const totalCombustivel = valorDiesel + valorGasolina;
    
    const total_gnd3 = total_parte_azul + totalCombustivel; 
    
    const totalDieselLitros = combustivelDestaRM
      .filter(l => l.tipo_suprimento === 'COMBUSTIVEL_DIESEL')
      .reduce((acc, l) => acc + l.total_litros_linha, 0);
    const totalGasolinaLitros = combustivelDestaRM
      .filter(l => l.tipo_suprimento === 'COMBUSTIVEL_GASOLINA')
      .reduce((acc, l) => acc + l.total_litros_linha, 0);

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
            fileSuffix={fileSuffix}
            generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculoUnificada}
            generateClasseIIMemoriaCalculo={generateClasseIIMemoriaCalculo}
            generateClasseVMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
            generateClasseVIMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
            generateClasseVIIMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
            generateClasseVIIIMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
            generateClasseIIIMemoriaCalculo={(registro) => generateClasseIIIMemoriaCalculo(registro, refLPC)} // NOVO: Passando a função de Classe III
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