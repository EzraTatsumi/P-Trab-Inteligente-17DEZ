import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatNumber } from "./formatUtils";

// --- Tipos de Dados ---

/**
 * Representa um registro salvo na tabela material_consumo_registros.
 */
export type MaterialConsumoRegistro = Tables<'material_consumo_registros'>;

/**
 * Representa um item de aquisição selecionado, incluindo a quantidade solicitada.
 * É a mesma estrutura de ItemAquisicao, mas garante a presença de quantidade_solicitada.
 */
export interface SelectedItemAquisicao extends ItemAquisicao {
    quantidade_solicitada: number;
}

/**
 * Representa um agrupamento lógico de itens de aquisição dentro do formulário.
 */
export interface AcquisitionGroup {
    id: string;
    nome: string;
    finalidade: string;
    itens: SelectedItemAquisicao[];
}

/**
 * Estado do formulário de Material de Consumo.
 */
export interface MaterialConsumoFormState {
    om_favorecida: string; 
    ug_favorecida: string; 
    om_destino: string; 
    ug_destino: string; 
    dias_operacao: number;
    efetivo: number; 
    fase_atividade: string;
    acquisition_groups: AcquisitionGroup[];
}

/**
 * Representa um registro de Material de Consumo calculado e pronto para ser salvo (staging).
 * Corresponde a um único Subitem (diretriz_id).
 */
export interface CalculatedMaterialConsumo extends TablesInsert<'material_consumo_registros'> {
    tempId: string; // ID temporário para gerenciamento local (ou ID do DB em edição)
    totalGeral: number;
    memoria_calculo_display: string;
    om_favorecida: string;
    ug_favorecida: string;
}

/**
 * Representa a estrutura consolidada de um Subitem (grupo de registros) para exibição.
 */
export interface ConsolidatedMaterialConsumoRecord {
    diretriz_id: string;
    nr_subitem: string;
    nome_subitem: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    records: MaterialConsumoRegistro[];
    totalGeral: number;
    totalND30: number;
    totalND39: number;
}

// --- Funções de Cálculo ---

/**
 * Calcula os totais (Geral, ND30, ND39) para um único item de aquisição.
 */
export function calculateItemTotals(item: SelectedItemAquisicao): { totalGeral: number, totalND30: number, totalND39: number } {
    const total = item.valor_unitario * item.quantidade_solicitada;
    
    let totalND30 = 0;
    let totalND39 = 0;
    
    if (item.gnd === '33.90.30') {
        totalND30 = total;
    } else if (item.gnd === '33.90.39') {
        totalND39 = total;
    }
    
    return {
        totalGeral: total,
        totalND30,
        totalND39,
    };
}

/**
 * Calcula os totais (Geral, ND30, ND39) para um lote de itens de aquisição (pertencentes a um Subitem).
 */
export function calculateLoteTotals(items: SelectedItemAquisicao[]): { totalGeral: number, totalND30: number, totalND39: number } {
    return items.reduce((acc, item) => {
        const totals = calculateItemTotals(item);
        acc.totalGeral += totals.totalGeral;
        acc.totalND30 += totals.totalND30;
        acc.totalND39 += totals.totalND39;
        return acc;
    }, { totalGeral: 0, totalND30: 0, totalND39: 0 });
}

// --- Funções de Memória de Cálculo ---

/**
 * Gera a memória de cálculo para um único registro de Material de Consumo (Subitem).
 */
export function generateMaterialConsumoMemoriaCalculo(registro: CalculatedMaterialConsumo | MaterialConsumoRegistro): string {
    const itens = (registro.itens_aquisicao_selecionados as unknown as SelectedItemAquisicao[]) || [];
    const totals = calculateLoteTotals(itens);
    
    let memoria = `MEMÓRIA DE CÁLCULO - MATERIAL DE CONSUMO (SUBITEM ${registro.nr_subitem})\n`;
    memoria += `------------------------------------------------------------------\n`;
    memoria += `OM Favorecida: ${registro.organizacao} (UG: ${registro.ug})\n`;
    memoria += `OM Destino Recurso: ${registro.om_detentora} (UG: ${registro.ug_detentora})\n`;
    memoria += `Fase da Atividade: ${registro.fase_atividade || 'N/A'}\n`;
    memoria += `Período: ${registro.dias_operacao} dias | Efetivo: ${registro.efetivo} militares\n`;
    memoria += `\n`;
    memoria += `ITENS DE AQUISIÇÃO SELECIONADOS:\n`;
    
    itens.forEach((item, index) => {
        const itemTotals = calculateItemTotals(item);
        memoria += `  ${index + 1}. ${item.descricao_reduzida} (CATMAT: ${item.codigo_catmat})\n`;
        memoria += `     - GND: ${item.gnd}\n`;
        memoria += `     - Qtd Solicitada: ${formatNumber(item.quantidade_solicitada, 0)} ${item.unidade_medida}\n`;
        memoria += `     - Valor Unitário: ${formatCurrency(item.valor_unitario)}\n`;
        memoria += `     - Total Item: ${formatCurrency(itemTotals.totalGeral)}\n`;
    });
    
    memoria += `\n`;
    memoria += `RESUMO DE CUSTOS:\n`;
    memoria += `  Total ND 33.90.30 (Consumo): ${formatCurrency(totals.totalND30)}\n`;
    memoria += `  Total ND 33.90.39 (Permanente): ${formatCurrency(totals.totalND39)}\n`;
    memoria += `  VALOR TOTAL DO SUBITEM: ${formatCurrency(totals.totalGeral)}\n`;
    
    return memoria;
}

/**
 * Gera a memória de cálculo consolidada para um grupo de registros (Subitem).
 * Inclui o detalhamento customizado, se existir.
 */
export function generateConsolidatedMaterialConsumoMemoriaCalculo(group: ConsolidatedMaterialConsumoRecord): string {
    const firstRecord = group.records[0];
    
    // Se houver detalhamento customizado, usa-o
    if (firstRecord.detalhamento_customizado) {
        return firstRecord.detalhamento_customizado;
    }
    
    // Caso contrário, gera a memória automática usando o primeiro registro (que contém os itens)
    return generateMaterialConsumoMemoriaCalculo(firstRecord);
}