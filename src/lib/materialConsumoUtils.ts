import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatCodug, formatNumber } from "./formatUtils";

// Tipo de registro do banco de dados
export type MaterialConsumoRegistro = Tables<'material_consumo_registros'>;

// Tipo de Item de Aquisição com a quantidade solicitada
export interface SelectedItemAquisicao extends ItemAquisicao {
    quantidade_solicitada: number;
}

// Tipo de registro consolidado (agrupado por subitem e dados de solicitação)
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
    
    records: MaterialConsumoRegistro[]; // Todos os registros de DB que compõem este grupo
    
    totalGeral: number;
    totalND30: number;
    totalND39: number;
}

// Tipo de dados para o formulário (inclui a lista de itens selecionados)
export interface MaterialConsumoFormState {
    om_favorecida: string; 
    ug_favorecida: string; 
    om_destino: string; 
    ug_destino: string; 
    dias_operacao: number;
    efetivo: number; 
    fase_atividade: string;
    
    // Dados dos Itens Selecionados (Lista de SelectedItemAquisicao)
    selected_itens: SelectedItemAquisicao[];
}

// Tipo para o registro calculado antes de salvar (staging)
export interface CalculatedMaterialConsumo extends TablesInsert<'material_consumo_registros'> {
    tempId: string; // ID temporário para gerenciamento local
    memoria_calculo_display: string; // A memória gerada
    totalGeral: number;
    totalND30: number;
    totalND39: number;
    
    // Campos para display
    om_favorecida: string;
    ug_favorecida: string;
    
    // Dados do Subitem (para display)
    nr_subitem: string;
    nome_subitem: string;
}

/**
 * Calcula os totais (Geral, ND 30, ND 39) para um único item de aquisição selecionado.
 * @param item O item de aquisição com a quantidade solicitada.
 * @returns Objeto com os totais calculados.
 */
export const calculateItemTotals = (item: SelectedItemAquisicao): { totalGeral: number, totalND30: number, totalND39: number } => {
    const valorUnitario = Number(item.valor_unitario || 0);
    const quantidade = Number(item.quantidade_solicitada || 0);
    const totalItem = valorUnitario * quantidade;
    
    // A alocação para ND 30 ou ND 39 é definida pelo GND do item de aquisição
    const gnd = item.gnd;
    
    let totalND30 = 0;
    let totalND39 = 0;
    
    if (gnd === 3) {
        totalND30 = totalItem;
    } else if (gnd === 4) {
        totalND39 = totalItem;
    }
    
    return {
        totalGeral: totalItem,
        totalND30: totalND30,
        totalND39: totalND39,
    };
};

/**
 * Calcula os totais (Geral, ND 30, ND 39) para um lote completo de itens selecionados.
 * @param selectedItens Array de SelectedItemAquisicao.
 * @returns Objeto com os totais consolidados.
 */
export const calculateLoteTotals = (selectedItens: SelectedItemAquisicao[]): { totalGeral: number, totalND30: number, totalND39: number } => {
    return selectedItens.reduce((acc, item) => {
        const totals = calculateItemTotals(item);
        acc.totalGeral += totals.totalGeral;
        acc.totalND30 += totals.totalND30;
        acc.totalND39 += totals.totalND39;
        return acc;
    }, { totalGeral: 0, totalND30: 0, totalND39: 0 });
};


/**
 * Gera a memória de cálculo para um registro de Material de Consumo (Subitem).
 * @param registro O registro calculado (staging) ou de DB.
 * @returns String formatada da memória de cálculo.
 */
export const generateMaterialConsumoMemoriaCalculo = (registro: MaterialConsumoRegistro | CalculatedMaterialConsumo): string => {
    // Se houver detalhamento customizado, ele prevalece
    if (registro.detalhamento_customizado) {
        return registro.detalhamento_customizado;
    }
    
    const itens = (registro.itens_aquisicao_selecionados as unknown as SelectedItemAquisicao[]) || [];
    
    if (itens.length === 0) {
        return "Nenhum item de aquisição selecionado.";
    }
    
    const omFavorecida = (registro as any).organizacao;
    const ugFavorecida = (registro as any).ug;
    const omDetentora = (registro as any).om_detentora;
    const ugDetentora = (registro as any).ug_detentora;
    const dias = (registro as any).dias_operacao;
    const efetivo = (registro as any).efetivo;
    const nrSubitem = (registro as any).nr_subitem;
    const nomeSubitem = (registro as any).nome_subitem;
    
    let memoria = `MEMÓRIA DE CÁLCULO - MATERIAL DE CONSUMO\n`;
    memoria += `Subitem ND: ${nrSubitem} - ${nomeSubitem}\n`;
    memoria += `OM Favorecida: ${omFavorecida} (UG: ${formatCodug(ugFavorecida)}) | OM Detentora: ${omDetentora} (UG: ${formatCodug(ugDetentora)})\n`;
    memoria += `Período: ${dias} dias | Efetivo: ${efetivo} militares\n\n`;
    
    memoria += `ITENS DE AQUISIÇÃO SELECIONADOS:\n`;
    
    itens.forEach((item, index) => {
        const totals = calculateItemTotals(item);
        const gndLabel = item.gnd === 3 ? 'ND 30' : 'ND 39';
        
        memoria += `\n${index + 1}. ${item.descricao_item}\n`;
        memoria += `   - Pregão: ${item.numero_pregao} | UASG: ${formatCodug(item.uasg)}\n`;
        memoria += `   - Cód. CATMAT: ${item.codigo_catmat} | GND: ${item.gnd}\n`;
        memoria += `   - Valor Unitário: ${formatCurrency(item.valor_unitario)} / ${item.unidade_medida}\n`;
        memoria += `   - Quantidade Solicitada: ${formatNumber(item.quantidade_solicitada, 0)} ${item.unidade_medida}\n`;
        memoria += `   - Total Item (${gndLabel}): ${formatCurrency(totals.totalGeral)}\n`;
    });
    
    const loteTotals = calculateLoteTotals(itens);
    
    memoria += `\n--------------------------------------------------\n`;
    memoria += `TOTAL GERAL DO SUBITEM: ${formatCurrency(loteTotals.totalGeral)}\n`;
    memoria += `Alocação ND 30: ${formatCurrency(loteTotals.totalND30)}\n`;
    memoria += `Alocação ND 39: ${formatCurrency(loteTotals.totalND39)}\n`;
    
    return memoria;
};

/**
 * Gera a memória de cálculo consolidada para um grupo de registros (Subitem).
 * @param group O grupo consolidado de registros.
 * @returns String formatada da memória de cálculo.
 */
export const generateConsolidatedMaterialConsumoMemoriaCalculo = (group: ConsolidatedMaterialConsumoRecord): string => {
    // O Material de Consumo é agrupado por Subitem. 
    // A memória customizada é salva no primeiro registro do grupo (records[0]).
    const firstRecord = group.records[0];
    
    if (firstRecord?.detalhamento_customizado) {
        return firstRecord.detalhamento_customizado;
    }
    
    // Se não houver customização, usa a memória automática do primeiro registro
    return generateMaterialConsumoMemoriaCalculo(firstRecord);
};