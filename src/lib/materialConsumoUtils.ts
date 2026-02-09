import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatCodug } from "./formatUtils";

// Tipo de registro salvo no banco de dados
export type MaterialConsumoRegistro = Tables<'material_consumo_registros'>;

// Tipo de registro consolidado (para exibição na Seção 4)
export interface ConsolidatedMaterialConsumoRecord {
    groupKey: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string | null;
    records: MaterialConsumoRegistro[];
    totalGeral: number;
    totalND30: number;
    totalND39: number;
}

// Tipo de grupo de aquisição (para gerenciamento na Seção 2)
export interface AcquisitionGroup {
    tempId: string;
    groupName: string;
    groupPurpose: string | null; // Finalidade
    items: ItemAquisicao[]; // Lista de itens importados (do diretrizesMaterialConsumo)
    totalValue: number;
    totalND30: number;
    totalND39: number;
}

/**
 * Calcula os totais de ND 30 e ND 39 para um grupo de aquisição.
 */
export function calculateGroupTotals(items: ItemAquisicao[]): { totalValue: number, totalND30: number, totalND39: number } {
    let totalValue = 0;
    let totalND30 = 0;
    let totalND39 = 0;

    items.forEach(item => {
        // CORREÇÃO 1, 5: Propriedade 'valor_total' agora existe em ItemAquisicao
        const value = Number(item.valor_total || 0); 
        totalValue += value;
        
        // CORREÇÃO 2, 3, 6: Propriedade 'nd' agora existe em ItemAquisicao
        if (item.nd === '33.90.30') { 
            totalND30 += value;
        } else if (item.nd === '33.90.39') { 
            totalND39 += value;
        } else {
            // Fallback: se a ND não estiver definida, assume ND 30 (padrão para material de consumo)
            totalND30 += value;
        }
    });

    return { totalValue, totalND30, totalND39 };
}

/**
 * Gera a memória de cálculo consolidada para um grupo de Material de Consumo.
 */
export function generateConsolidatedMaterialConsumoMemoriaCalculo(group: ConsolidatedMaterialConsumoRecord): string {
    const omFavorecida = `${group.organizacao} (UG: ${formatCodug(group.ug)})`;
    const omDetentora = `${group.om_detentora} (UG: ${formatCodug(group.ug_detentora)})`;
    const fase = group.fase_atividade || 'Não Definida';
    
    let memoria = `MEMÓRIA DE CÁLCULO - MATERIAL DE CONSUMO (ND 33.90.30/39)\n`;
    memoria += `----------------------------------------------------------------\n`;
    memoria += `OM Favorecida: ${omFavorecida}\n`;
    memoria += `OM Destino Recurso: ${omDetentora}\n`;
    memoria += `Fase da Atividade: ${fase}\n`;
    memoria += `Período: ${group.dias_operacao} dias | Efetivo: ${group.efetivo} militares\n`;
    memoria += `\n`;
    
    group.records.forEach((registro, index) => {
        const groupName = registro.group_name;
        const groupPurpose = registro.group_purpose || 'N/A';
        const itens = (registro.itens_aquisicao as unknown as ItemAquisicao[]) || [];
        
        memoria += `GRUPO ${index + 1}: ${groupName}\n`;
        memoria += `Finalidade: ${groupPurpose}\n`;
        memoria += `Valor Total do Grupo: ${formatCurrency(registro.valor_total)}\n`;
        memoria += `\n`;
        
        if (itens.length > 0) {
            memoria += `  ITENS DE AQUISIÇÃO (${itens.length}):\n`;
            itens.forEach(item => {
                memoria += `  - ${item.descricao_item} (CATMAT: ${item.codigo_catmat || 'N/A'})\n`;
                // CORREÇÃO 4, 5, 6: Propriedades 'quantidade', 'valor_total' e 'nd' agora existem
                memoria += `    Qtd: ${item.quantidade} | Vl Unit: ${formatCurrency(item.valor_unitario)} | Vl Total: ${formatCurrency(item.valor_total)} (ND ${item.nd})\n`; 
            });
            memoria += `\n`;
        } else {
            memoria += `  (Nenhum item de aquisição detalhado)\n\n`;
        }
    });
    
    memoria += `----------------------------------------------------------------\n`;
    memoria += `TOTAL GERAL (ND 30): ${formatCurrency(group.totalND30)}\n`;
    memoria += `TOTAL GERAL (ND 39): ${formatCurrency(group.totalND39)}\n`;
    memoria += `TOTAL GERAL (GND 3): ${formatCurrency(group.totalGeral)}\n`;
    
    return memoria;
}