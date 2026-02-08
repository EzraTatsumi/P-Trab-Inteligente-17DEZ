import { SelectedItemAquisicao, CalculatedMaterialConsumo, ConsolidatedMaterialConsumoRecord } from "@/types/materialConsumo";
import { formatCurrency, formatNumber } from "./formatUtils";

/**
 * Calcula os totais (Geral, ND30, ND39) para um único item de aquisição.
 */
export function calculateItemTotals(item: SelectedItemAquisicao): { totalGeral: number, totalND30: number, totalND39: number } {
    const total = item.valor_unitario * item.quantidade_solicitada;
    
    return {
        totalGeral: total,
        totalND30: item.gnd === '30' ? total : 0,
        totalND39: item.gnd === '39' ? total : 0,
    };
}

/**
 * Calcula os totais (Geral, ND30, ND39) para um lote de itens de aquisição.
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

/**
 * Gera a memória de cálculo para um registro individual de Material de Consumo (Subitem).
 */
export function generateMaterialConsumoMemoriaCalculo(registro: CalculatedMaterialConsumo): string {
    const { itens_aquisicao_selecionados, dias_operacao, efetivo, valor_nd_30, valor_nd_39, valor_total } = registro;
    
    const itens = (itens_aquisicao_selecionados as unknown as SelectedItemAquisicao[]) || [];
    
    let memoria = `MEMÓRIA DE CÁLCULO - MATERIAL DE CONSUMO (SUBITEM ${registro.nr_subitem})\n`;
    memoria += `------------------------------------------------------------------\n`;
    memoria += `OM Favorecida: ${registro.organizacao} (UG: ${registro.ug})\n`;
    memoria += `OM Destino Recurso: ${registro.om_detentora} (UG: ${registro.ug_detentora})\n`;
    memoria += `Período: ${dias_operacao} dias | Efetivo: ${efetivo} militares\n`;
    memoria += `Fase da Atividade: ${registro.fase_atividade || 'Não Informada'}\n`;
    memoria += `\n`;
    memoria += `ITENS DE AQUISIÇÃO SELECIONADOS:\n`;
    
    itens.forEach(item => {
        const totals = calculateItemTotals(item);
        memoria += `  - ${item.descricao_reduzida} (CATMAT: ${item.codigo_catmat})\n`;
        memoria += `    > Qtd Solicitada: ${formatNumber(item.quantidade_solicitada, 0)} ${item.unidade_medida}\n`;
        memoria += `    > Valor Unitário: ${formatCurrency(item.valor_unitario)}\n`;
        memoria += `    > Total Item: ${formatCurrency(totals.totalGeral)} (ND 33.90.${item.gnd})\n`;
    });
    
    memoria += `\n`;
    memoria += `RESUMO FINANCEIRO:\n`;
    memoria += `  ND 33.90.30 (Consumo): ${formatCurrency(valor_nd_30)}\n`;
    memoria += `  ND 33.90.39 (Permanente): ${formatCurrency(valor_nd_39)}\n`;
    memoria += `  TOTAL GERAL: ${formatCurrency(valor_total)}\n`;
    memoria += `------------------------------------------------------------------\n`;
    
    return memoria;
}

/**
 * Gera a memória de cálculo consolidada para um grupo de registros salvos (Subitem).
 */
export function generateConsolidatedMaterialConsumoMemoriaCalculo(group: ConsolidatedMaterialConsumoRecord): string {
    const { records, dias_operacao, efetivo, totalND30, totalND39, totalGeral } = group;
    
    // Como o grupo consolidado é por Subitem, todos os records têm o mesmo Subitem.
    const subitem = records[0]?.nr_subitem || 'N/A';
    const nomeSubitem = records[0]?.nome_subitem || 'Subitem Desconhecido';
    
    let memoria = `MEMÓRIA DE CÁLCULO CONSOLIDADA - SUBITEM ${subitem} (${nomeSubitem})\n`;
    memoria += `------------------------------------------------------------------\n`;
    memoria += `OM Favorecida: ${group.organizacao} (UG: ${group.ug})\n`;
    memoria += `OM Destino Recurso: ${group.om_detentora} (UG: ${group.ug_detentora})\n`;
    memoria += `Período: ${dias_operacao} dias | Efetivo: ${efetivo} militares\n`;
    memoria += `Fase da Atividade: ${group.fase_atividade || 'Não Informada'}\n`;
    memoria += `\n`;
    memoria += `ITENS DE AQUISIÇÃO DETALHADOS:\n`;
    
    // Agrupar todos os itens de aquisição de todos os registros (deveria ser apenas um Subitem)
    const allItems: SelectedItemAquisicao[] = records.flatMap(r => 
        (r.itens_aquisicao_selecionados as unknown as SelectedItemAquisicao[]) || []
    );
    
    // Agrupar por CATMAT para consolidar quantidades (se houver duplicidade)
    const consolidatedItems = allItems.reduce((acc, item) => {
        if (!acc[item.id]) {
            acc[item.id] = { ...item, quantidade_solicitada: 0 };
        }
        acc[item.id].quantidade_solicitada += item.quantidade_solicitada;
        return acc;
    }, {} as Record<string, SelectedItemAquisicao>);
    
    Object.values(consolidatedItems).forEach(item => {
        const totals = calculateItemTotals(item);
        memoria += `  - ${item.descricao_reduzida} (CATMAT: ${item.codigo_catmat})\n`;
        memoria += `    > Qtd Solicitada: ${formatNumber(item.quantidade_solicitada, 0)} ${item.unidade_medida}\n`;
        memoria += `    > Valor Unitário: ${formatCurrency(item.valor_unitario)}\n`;
        memoria += `    > Total Item: ${formatCurrency(totals.totalGeral)} (ND 33.90.${item.gnd})\n`;
    });
    
    memoria += `\n`;
    memoria += `RESUMO FINANCEIRO CONSOLIDADO:\n`;
    memoria += `  ND 33.90.30 (Consumo): ${formatCurrency(totalND30)}\n`;
    memoria += `  ND 33.90.39 (Permanente): ${formatCurrency(totalND39)}\n`;
    memoria += `  TOTAL GERAL: ${formatCurrency(totalGeral)}\n`;
    memoria += `------------------------------------------------------------------\n`;
    
    return memoria;
}

// Exportando os tipos necessários para o formulário
export type { SelectedItemAquisicao, AcquisitionGroup, MaterialConsumoFormState, CalculatedMaterialConsumo, ConsolidatedMaterialConsumoRecord };