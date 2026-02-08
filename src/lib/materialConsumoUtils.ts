import { formatCurrency, formatNumber } from "./formatUtils";
import { MaterialConsumoGrupo, ConsolidatedMaterialConsumo } from "@/types/materialConsumo";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";

/**
 * Calcula os totais e gera a memória de cálculo para um grupo de Material de Consumo.
 * @param grupo O grupo de material de consumo com itens selecionados e quantidades.
 * @returns O grupo atualizado com totais e memória.
 */
export function calculateMaterialConsumoTotals(grupo: MaterialConsumoGrupo): MaterialConsumoGrupo {
    let valorND30 = 0;
    let valorND39 = 0;
    
    // 1. Calcular totais
    grupo.itensSelecionados.forEach(item => {
        const valorTotalItem = item.quantidade * item.valor_unitario;
        
        // Assumimos que Material de Consumo (33.90.30) é o principal, mas o item pode ter ND 39
        if (item.nd === '33.90.30') {
            valorND30 += valorTotalItem;
        } else if (item.nd === '33.90.39') {
            valorND39 += valorTotalItem;
        }
    });
    
    const totalLinha = valorND30 + valorND39;
    
    // 2. Gerar memória de cálculo
    const memoriaCalculo = generateMaterialConsumoMemoriaCalculo(grupo, valorND30, valorND39);

    return {
        ...grupo,
        valorND30: valorND30,
        valorND39: valorND39,
        totalLinha: totalLinha,
        memoriaCalculo: memoriaCalculo,
    };
}

/**
 * Gera a string da memória de cálculo para um grupo de Material de Consumo.
 */
export function generateMaterialConsumoMemoriaCalculo(grupo: MaterialConsumoGrupo, valorND30: number, valorND39: number): string {
    const lines: string[] = [];
    
    lines.push(`SOLICITAÇÃO DE MATERIAL DE CONSUMO (ND 33.90.30 e 33.90.39)`);
    lines.push(`OM Favorecida: ${grupo.organizacao} (UG: ${grupo.ug})`);
    lines.push(`OM Destino Recurso: ${grupo.om_detentora} (UG: ${grupo.ug_detentora})`);
    lines.push(`Fase da Atividade: ${grupo.fase_atividade}`);
    lines.push(`Período: ${grupo.dias_operacao} dias | Efetivo: ${grupo.efetivo} militares`);
    lines.push(`Subitem ND: ${grupo.nrSubitem} - ${grupo.nomeSubitem}`);
    lines.push('---');
    
    grupo.itensSelecionados.forEach(item => {
        const totalItem = item.quantidade * item.valor_unitario;
        lines.push(
            `[${item.nd}] ${formatNumber(item.quantidade, 0)} x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(totalItem)} | ${item.descricao_item} (CATMAT: ${item.codigo_catmat})`
        );
    });
    
    lines.push('---');
    lines.push(`TOTAL ND 33.90.30: ${formatCurrency(valorND30)}`);
    lines.push(`TOTAL ND 33.90.39: ${formatCurrency(valorND39)}`);
    lines.push(`TOTAL GERAL: ${formatCurrency(valorND30 + valorND39)}`);
    
    return lines.join('\n');
}

/**
 * Gera a memória de cálculo consolidada para exibição na Seção 5.
 * @param group O grupo consolidado de registros do DB.
 * @returns A string da memória de cálculo.
 */
export function generateConsolidatedMaterialConsumoMemoriaCalculo(group: ConsolidatedMaterialConsumo): string {
    // Se houver memória customizada no primeiro registro, usa ela.
    if (group.records[0]?.detalhamento_customizado) {
        return group.records[0].detalhamento_customizado;
    }
    
    const lines: string[] = [];
    
    lines.push(`SOLICITAÇÃO DE MATERIAL DE CONSUMO (ND 33.90.30 e 33.90.39)`);
    lines.push(`OM Favorecida: ${group.organizacao} (UG: ${group.ug})`);
    lines.push(`OM Destino Recurso: ${group.om_detentora} (UG: ${group.ug_detentora})`);
    lines.push(`Fase da Atividade: ${group.fase_atividade}`);
    lines.push(`Período: ${group.dias_operacao} dias | Efetivo: ${group.efetivo} militares`);
    
    // Agrupar itens por subitem ND
    const subitemGroups = group.records.reduce((acc, record) => {
        const key = `${record.nr_subitem}-${record.nome_subitem}`;
        if (!acc[key]) {
            acc[key] = {
                nrSubitem: record.nr_subitem,
                nomeSubitem: record.nome_subitem,
                itens: [] as ItemAquisicao[],
                totalND30: 0,
                totalND39: 0,
            };
        }
        
        const item = record.item_aquisicao;
        const totalItem = item.quantidade * item.valor_unitario;
        
        if (item.nd === '33.90.30') {
            acc[key].totalND30 += totalItem;
        } else if (item.nd === '33.90.39') {
            acc[key].totalND39 += totalItem;
        }
        
        acc[key].itens.push(item);
        return acc;
    }, {} as Record<string, { nrSubitem: string, nomeSubitem: string, itens: ItemAquisicao[], totalND30: number, totalND39: number }>);
    
    lines.push('---');
    
    Object.values(subitemGroups).forEach(subitemGroup => {
        lines.push(`Subitem ND: ${subitemGroup.nrSubitem} - ${subitemGroup.nomeSubitem}`);
        
        subitemGroup.itens.forEach(item => {
            const totalItem = item.quantidade * item.valor_unitario;
            lines.push(
                `[${item.nd}] ${formatNumber(item.quantidade, 0)} x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(totalItem)} | ${item.descricao_item} (CATMAT: ${item.codigo_catmat})`
            );
        });
        
        lines.push(`Subtotal ND 30: ${formatCurrency(subitemGroup.totalND30)} | Subtotal ND 39: ${formatCurrency(subitemGroup.totalND39)}`);
        lines.push('---');
    });
    
    lines.push(`TOTAL GERAL ND 33.90.30: ${formatCurrency(group.totalND30)}`);
    lines.push(`TOTAL GERAL ND 33.90.39: ${formatCurrency(group.totalND39)}`);
    lines.push(`TOTAL GERAL: ${formatCurrency(group.totalGeral)}`);
    
    return lines.join('\n');
}