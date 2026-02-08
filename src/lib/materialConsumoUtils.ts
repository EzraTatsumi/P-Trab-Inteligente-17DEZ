import { Tables, TablesInsert, Json } from "@/integrations/supabase/types";
import { ItemAquisicao, DiretrizMaterialConsumo } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatNumber, formatCodug } from "./formatUtils";

// =================================================================
// TIPOS DE DADOS
// =================================================================

// Tipo de registro salvo no banco de dados
export type MaterialConsumoRegistro = Tables<'material_consumo_registros'>;

// Tipo de item de aquisição selecionado (inclui a quantidade solicitada)
export interface SelectedItemAquisicao extends ItemAquisicao {
    quantidade_solicitada: number;
    diretriz_id: string; // ID da diretriz (Subitem) de onde veio
    nr_subitem: string;
    nome_subitem: string;
}

// Tipo para agrupar itens de aquisição dentro do formulário (Seção 2)
export interface AcquisitionGroup {
    id: string; // ID temporário do grupo
    nome: string;
    finalidade: string;
    itens: SelectedItemAquisicao[];
}

// Estado do formulário (Seção 2)
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

// Tipo de registro calculado (staging)
export interface CalculatedMaterialConsumo extends Omit<TablesInsert<'material_consumo_registros'>, 'itens_aquisicao_selecionados'> {
    tempId: string; // ID temporário para gerenciamento local
    totalGeral: number;
    memoria_calculo_display: string; // A memória gerada
    om_favorecida: string; // Para display
    ug_favorecida: string; // Para display
    
    // Campos necessários para o cálculo/display, mas que serão convertidos para Json no insert
    itens_aquisicao_selecionados: SelectedItemAquisicao[];
}

// Tipo para o registro consolidado (para exibição na Seção 4 e Memória)
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
    records: MaterialConsumoRegistro[]; // Registros originais do DB
    totalGeral: number;
    totalND30: number;
    totalND39: number;
}

// =================================================================
// FUNÇÕES DE CÁLCULO
// =================================================================

/**
 * Calcula os totais (Geral, ND 30, ND 39) para um único item de aquisição.
 */
export function calculateItemTotals(item: SelectedItemAquisicao): { totalGeral: number, totalND30: number, totalND39: number } {
    const totalGeral = item.valor_unitario * item.quantidade_solicitada;
    
    const totalND30 = item.gnd === '33.90.30' ? totalGeral : 0;
    const totalND39 = item.gnd === '33.90.39' ? totalGeral : 0;
    
    return { totalGeral, totalND30, totalND39 };
}

/**
 * Calcula os totais (Geral, ND 30, ND 39) para um lote de itens de aquisição.
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

// =================================================================
// GERAÇÃO DE MEMÓRIA DE CÁLCULO
// =================================================================

/**
 * Gera a memória de cálculo para um registro individual de Material de Consumo (usado no staging).
 */
export function generateMaterialConsumoMemoriaCalculo(registro: CalculatedMaterialConsumo): string {
    const { itens_aquisicao_selecionados, dias_operacao, efetivo, om_detentora, ug_detentora, fase_atividade } = registro;
    
    let memoria = `MEMÓRIA DE CÁLCULO - MATERIAL DE CONSUMO\n`;
    memoria += `--------------------------------------------------\n`;
    memoria += `P Trab: ${registro.p_trab_id}\n`;
    memoria += `Subitem ND: ${registro.nr_subitem} - ${registro.nome_subitem}\n`;
    memoria += `Fase da Atividade: ${fase_atividade || 'N/A'}\n`;
    memoria += `OM Destino Recurso: ${om_detentora} (UG: ${formatCodug(ug_detentora)})\n`;
    memoria += `Período: ${dias_operacao} dias | Efetivo: ${efetivo} militares\n`;
    memoria += `--------------------------------------------------\n`;
    
    const totals = calculateLoteTotals(itens_aquisicao_selecionados);
    
    let itemsDetail = `ITENS DE AQUISIÇÃO SELECIONADOS:\n`;
    
    itens_aquisicao_selecionados.forEach(item => {
        const totalItem = item.valor_unitario * item.quantidade_solicitada;
        itemsDetail += `\n- ${item.descricao_reduzida || item.descricao_item}\n`;
        itemsDetail += `  CATMAT: ${item.codigo_catmat} | GND: ${item.gnd}\n`;
        itemsDetail += `  Qtd: ${item.quantidade_solicitada} x Valor Unitário: R$ ${item.valor_unitario.toFixed(2)} ${item.unidade_medida} = R$ ${totalItem.toFixed(2)}\n`;
    });
    
    memoria += itemsDetail;
    memoria += `\n--------------------------------------------------\n`;
    memoria += `TOTAL GERAL (ND 30 + ND 39): ${formatCurrency(totals.totalGeral)}\n`;
    memoria += `ND 33.90.30 (Consumo): ${formatCurrency(totals.totalND30)}\n`;
    memoria += `ND 33.90.39 (Permanente): ${formatCurrency(totals.totalND39)}\n`;
    
    return memoria;
}

/**
 * Gera a memória de cálculo para um grupo consolidado de Material de Consumo (usado na Seção 5).
 */
export function generateConsolidatedMaterialConsumoMemoriaCalculo(group: ConsolidatedMaterialConsumoRecord): string {
    const { records, nr_subitem, nome_subitem, organizacao, ug, om_detentora, ug_detentora, dias_operacao, efetivo, fase_atividade, totalND30, totalND39, totalGeral } = group;
    
    // Se houver detalhamento customizado no primeiro registro, usa ele.
    const customDetalhamento = records[0]?.detalhamento_customizado;
    if (customDetalhamento) {
        return customDetalhamento;
    }
    
    let memoria = `MEMÓRIA DE CÁLCULO - MATERIAL DE CONSUMO (CONSOLIDADO)\n`;
    memoria += `--------------------------------------------------\n`;
    memoria += `Subitem ND: ${nr_subitem} - ${nome_subitem}\n`;
    memoria += `OM Favorecida: ${organizacao} (UG: ${formatCodug(ug)})\n`;
    memoria += `OM Destino Recurso: ${om_detentora} (UG: ${formatCodug(ug_detentora)})\n`;
    memoria += `Fase da Atividade: ${fase_atividade || 'N/A'}\n`;
    memoria += `Período: ${dias_operacao} dias | Efetivo: ${efetivo} militares\n`;
    memoria += `--------------------------------------------------\n`;
    
    // Agrega todos os itens de aquisição de todos os registros do grupo
    const allItems: SelectedItemAquisicao[] = records.flatMap(record => 
        (record.itens_aquisicao_selecionados as unknown as SelectedItemAquisicao[]) || []
    );
    
    // Agrupa os itens por CATMAT/GND para exibição limpa
    const aggregatedItems = allItems.reduce((acc, item) => {
        const key = `${item.codigo_catmat}-${item.gnd}`;
        if (!acc[key]) {
            acc[key] = {
                ...item,
                quantidade_solicitada: 0,
                totalGeral: 0,
            };
        }
        const totals = calculateItemTotals(item);
        acc[key].quantidade_solicitada += item.quantidade_solicitada;
        acc[key].totalGeral += totals.totalGeral;
        return acc;
    }, {} as Record<string, SelectedItemAquisicao & { totalGeral: number }>);
    
    memoria += `ITENS DE AQUISIÇÃO CONSOLIDADOS:\n`;
    
    Object.values(aggregatedItems).forEach(item => {
        memoria += `\n- ${item.descricao_reduzida || item.descricao_item}\n`;
        memoria += `  CATMAT: ${item.codigo_catmat} | GND: ${item.gnd}\n`;
        memoria += `  Qtd Total: ${formatNumber(item.quantidade_solicitada, 0)} x Valor Unitário: R$ ${item.valor_unitario.toFixed(2)} ${item.unidade_medida} = R$ ${item.totalGeral.toFixed(2)}\n`;
    });
    
    memoria += `\n--------------------------------------------------\n`;
    memoria += `TOTAL GERAL (ND 30 + ND 39): ${formatCurrency(totalGeral)}\n`;
    memoria += `ND 33.90.30 (Consumo): ${formatCurrency(totalND30)}\n`;
    memoria += `ND 33.90.39 (Permanente): ${formatCurrency(totalND39)}\n`;
    
    return memoria;
}