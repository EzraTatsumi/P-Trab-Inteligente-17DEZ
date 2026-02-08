import { Tables } from "@/integrations/supabase/types";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";

// Tipo base para um item de aquisição selecionado, agora incluindo metadados do Subitem
export interface SelectedItemAquisicao extends ItemAquisicao {
    quantidade_solicitada: number;
    diretriz_id: string; // ID da diretriz (Subitem)
    nr_subitem: string; // Número do Subitem (ex: 33.90.30.01)
    nome_subitem: string; // Nome do Subitem
}

// NOVO TIPO: Representa um grupo lógico de aquisição dentro de um registro de Material de Consumo
export interface AcquisitionGroup {
    id: string; // ID temporário para rastreamento no formulário
    nome: string;
    finalidade: string;
    itens: SelectedItemAquisicao[];
}

// Tipo de dados para o estado do formulário principal
export interface MaterialConsumoFormState {
    om_favorecida: string; 
    ug_favorecida: string; 
    om_destino: string;
    ug_destino: string;
    dias_operacao: number;
    efetivo: number; 
    fase_atividade: string;
    // Alterado para armazenar grupos de aquisição
    acquisition_groups: AcquisitionGroup[]; 
}

// Tipo de dados para o registro calculado (antes de salvar no DB)
export interface CalculatedMaterialConsumo {
    tempId: string; // ID temporário ou ID do DB (para edição)
    p_trab_id: string;
    
    // Dados do Lote (Solicitação)
    organizacao: string; 
    ug: string; 
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    
    // Dados do Subitem (Agrupamento de DB)
    diretriz_id: string;
    nr_subitem: string;
    nome_subitem: string;
    
    // Itens de Aquisição (apenas aqueles pertencentes a este Subitem)
    itens_aquisicao_selecionados: Tables<'material_consumo_registros'>['itens_aquisicao_selecionados'];
    
    // Totais
    valor_total: number;
    valor_nd_30: number;
    valor_nd_39: number;
    
    // Detalhamento
    detalhamento: string | null;
    detalhamento_customizado: string | null;
    
    // Campos auxiliares para display
    totalGeral: number;
    memoria_calculo_display: string;
    om_favorecida: string;
    ug_favorecida: string;
}

// Tipo de dados para o registro consolidado (após buscar do DB)
export interface ConsolidatedMaterialConsumoRecord {
    groupKey: string; 
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
    records: Tables<'material_consumo_registros'>[];
    totalGeral: number;
    totalND30: number;
    totalND39: number;
}

// =================================================================
// FUNÇÕES DE CÁLCULO
// =================================================================

/**
 * Calcula os totais (Geral, ND30, ND39) para um único item de aquisição selecionado.
 */
export const calculateItemTotals = (item: SelectedItemAquisicao) => {
    const valorUnitario = Number(item.valor_unitario || 0);
    const quantidade = Number(item.quantidade_solicitada || 0);
    const totalGeral = valorUnitario * quantidade;
    
    // Material de Consumo (ND 33.90.30) vs Material Permanente (ND 33.90.39)
    const isPermanente = item.gnd === '33.90.39';
    
    return {
        totalGeral,
        totalND30: isPermanente ? 0 : totalGeral,
        totalND39: isPermanente ? totalGeral : 0,
    };
};

/**
 * Calcula os totais (Geral, ND30, ND39) para um lote de itens de aquisição (pode ser um grupo ou um subitem).
 */
export const calculateLoteTotals = (itens: SelectedItemAquisicao[]) => {
    let totalGeral = 0;
    let totalND30 = 0;
    let totalND39 = 0;
    
    itens.forEach(item => {
        const totals = calculateItemTotals(item);
        totalGeral += totals.totalGeral;
        totalND30 += totals.totalND30;
        totalND39 += totals.totalND39;
    });
    
    return {
        totalGeral,
        totalND30,
        totalND39,
    };
};

/**
 * Gera a memória de cálculo para um registro de Material de Consumo (Subitem).
 */
export const generateMaterialConsumoMemoriaCalculo = (registro: Tables<'material_consumo_registros'> | CalculatedMaterialConsumo): string => {
    const itens = (registro.itens_aquisicao_selecionados as unknown as SelectedItemAquisicao[]) || [];
    
    if (itens.length === 0) {
        return "Nenhum item de aquisição selecionado.";
    }
    
    const header = `MEMÓRIA DE CÁLCULO - SUBITEM ND ${registro.nr_subitem} (${registro.nome_subitem})\n`;
    const info = `OM Favorecida: ${registro.organizacao} (${registro.ug})\nOM Destino Recurso: ${registro.om_detentora} (${registro.ug_detentora})\nPeríodo: ${registro.dias_operacao} dias | Efetivo: ${registro.efetivo}\nFase da Atividade: ${registro.fase_atividade}\n\n`;
    
    let itemsDetail = "ITENS DE AQUISIÇÃO:\n";
    
    itens.forEach(item => {
        const totals = calculateItemTotals(item);
        const totalItem = totals.totalGeral;
        
        if (item.quantidade_solicitada > 0) {
            itemsDetail += `- ${item.descricao_reduzida || item.descricao_item} (CATMAT: ${item.codigo_catmat})\n`;
            itemsDetail += `  Qtd: ${item.quantidade_solicitada} x Valor Unitário: R$ ${item.valor_unitario.toFixed(2)} = R$ ${totalItem.toFixed(2)}\n`;
            itemsDetail += `  GND: ${item.gnd}\n`;
        }
    });
    
    const totals = calculateLoteTotals(itens);
    
    const footer = `\nRESUMO DO SUBITEM:\n` +
                   `Total ND 33.90.30 (Consumo): R$ ${totals.totalND30.toFixed(2)}\n` +
                   `Total ND 33.90.39 (Permanente): R$ ${totals.totalND39.toFixed(2)}\n` +
                   `TOTAL GERAL DO SUBITEM: R$ ${totals.totalGeral.toFixed(2)}`;
                   
    return header + info + itemsDetail + footer;
};

/**
 * Gera a memória de cálculo consolidada para todos os registros de Material de Consumo de um PTrab.
 */
export const generateConsolidatedMaterialConsumoMemoriaCalculo = (consolidatedRecords: ConsolidatedMaterialConsumoRecord[]): string => {
    if (consolidatedRecords.length === 0) {
        return "Nenhum registro de Material de Consumo encontrado.";
    }
    
    let totalGeralPTrab = 0;
    let totalND30PTrab = 0;
    let totalND39PTrab = 0;
    
    let output = "RELATÓRIO CONSOLIDADO DE MATERIAL DE CONSUMO\n\n";
    
    consolidatedRecords.forEach((group, index) => {
        output += `==================================================\n`;
        output += `LOTE ${index + 1}: SUBITEM ND ${group.nr_subitem} - ${group.nome_subitem}\n`;
        output += `OM Favorecida: ${group.organizacao} (${group.ug})\n`;
        output += `OM Destino Recurso: ${group.om_detentora} (${group.ug_detentora})\n`;
        output += `Período: ${group.dias_operacao} dias | Efetivo: ${group.efetivo}\n`;
        output += `Fase da Atividade: ${group.fase_atividade}\n`;
        output += `\n`;
        
        // Detalhe dos itens (usando o primeiro registro do grupo, pois todos são iguais)
        const firstRecord = group.records[0];
        const itens = (firstRecord.itens_aquisicao_selecionados as unknown as SelectedItemAquisicao[]) || [];
        
        output += "ITENS DE AQUISIÇÃO SELECIONADOS:\n";
        itens.forEach(item => {
            const totals = calculateItemTotals(item);
            if (item.quantidade_solicitada > 0) {
                output += `- ${item.descricao_reduzida || item.descricao_item} (Qtd: ${item.quantidade_solicitada}, Total: R$ ${totals.totalGeral.toFixed(2)}, GND: ${item.gnd})\n`;
            }
        });
        
        output += `\nRESUMO DO SUBITEM:\n` +
                  `Total ND 33.90.30 (Consumo): R$ ${group.totalND30.toFixed(2)}\n` +
                  `Total ND 33.90.39 (Permanente): R$ ${group.totalND39.toFixed(2)}\n` +
                  `TOTAL GERAL DO SUBITEM: R$ ${group.totalGeral.toFixed(2)}\n\n`;
                  
        totalGeralPTrab += group.totalGeral;
        totalND30PTrab += group.totalND30;
        totalND39PTrab += group.totalND39;
    });
    
    output += `==================================================\n`;
    output += `TOTAL CONSOLIDADO DO P TRAB:\n`;
    output += `Total ND 33.90.30 (Consumo): R$ ${totalND30PTrab.toFixed(2)}\n`;
    output += `Total ND 33.90.39 (Permanente): R$ ${totalND39PTrab.toFixed(2)}\n`;
    output += `TOTAL GERAL: R$ ${totalGeralPTrab.toFixed(2)}\n`;
    
    return output;
};