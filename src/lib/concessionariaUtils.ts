import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { ConcessionariaDiretrizSelection, CategoriaConcessionaria } from "@/types/diretrizesConcessionaria";
import { formatCurrency, formatCodug } from "./formatUtils";

// Tipo de registro no DB
export type ConcessionariaRegistro = Tables<'concessionaria_registros'>;

// Tipo para o registro consolidado (agrupado)
export interface ConsolidatedConcessionariaRecord {
    organizacao: string;
    ug: string;
    om_detentora: string | null;
    ug_detentora: string | null;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string | null;
    records: ConcessionariaRegistro[];
    totalGeral: number;
    totalND39: number;
}

/**
 * Calcula o valor total de um registro de concessionária.
 * @param diretriz O item de seleção.
 * @returns O valor total.
 */
export const calculateConcessionariaTotal = (
    efetivo: number, 
    dias_operacao: number, 
    diretriz: ConcessionariaDiretrizSelection
): number => {
    // Assumimos que o campo 'quantidade_solicitada' é o volume/energia total necessário.
    const total = diretriz.quantidade_solicitada * diretriz.custo_unitario;
    return total;
};

/**
 * Gera a memória de cálculo para um registro individual de Concessionária.
 * @param registro O registro de Concessionária.
 */
export const generateConcessionariaMemoriaCalculo = (registro: ConcessionariaRegistro): string => {
    const { 
        organizacao, ug, om_detentora, ug_detentora, dias_operacao, efetivo, 
        categoria, valor_unitario, consumo_pessoa_dia, valor_total, detalhamento,
    } = registro;
    
    // Evita divisão por zero
    const totalUnidades = Number(registro.valor_unitario) > 0 
        ? Number(registro.valor_total) / Number(registro.valor_unitario)
        : 0;
        
    const unidadeCusto = detalhamento?.match(/\((.*?)\/dia\)/)?.[1] || 'unidade'; 
    
    let memoria = `MEMÓRIA DE CÁLCULO - ${categoria.toUpperCase()}\n`;
    memoria += `OM Favorecida: ${organizacao} (UG: ${formatCodug(ug)})\n`;
    memoria += `OM Destino Recurso: ${om_detentora} (UG: ${formatCodug(ug_detentora)})\n`;
    memoria += `Fase da Atividade: ${registro.fase_atividade || 'Não Informada'}\n`;
    memoria += `Período: ${dias_operacao} dias | Efetivo: ${efetivo} militares\n\n`;
    
    memoria += `1. Cálculo do Consumo Total:\n`;
    memoria += `   - Consumo por Pessoa/Dia: ${consumo_pessoa_dia} ${unidadeCusto}/dia\n`;
    memedia += `   - Total de Unidades (m³ ou kWh) = Efetivo (${efetivo}) x Dias (${dias_operacao}) x Consumo/Pessoa/Dia (${consumo_pessoa_dia})\n`;
    memoria += `   - Total de Unidades Solicitadas: ${totalUnidades.toFixed(2)} ${unidadeCusto}\n\n`;
    
    memoria += `2. Cálculo do Custo Total:\n`;
    memoria += `   - Custo Unitário: ${formatCurrency(valor_unitario)} / ${unidadeCusto}\n`;
    memoria += `   - Valor Total = Total de Unidades (${totalUnidades.toFixed(2)}) x Custo Unitário (${formatCurrency(valor_unitario)})\n`;
    memoria += `   - Valor Total (ND 33.90.39): ${formatCurrency(valor_total)}\n`;
    
    return memoria;
};

/**
 * Gera a memória de cálculo consolidada para um grupo de registros de Concessionária.
 * @param group O grupo consolidado de registros.
 */
export const generateConsolidatedConcessionariaMemoriaCalculo = (group: ConsolidatedConcessionariaRecord): string => {
    const { 
        organizacao, ug, om_detentora, ug_detentora, dias_operacao, efetivo, 
        totalGeral, totalND39, records 
    } = group;
    
    if (records.length === 0) return "Nenhum registro para consolidar.";
    
    let memoria = `MEMÓRIA DE CÁLCULO CONSOLIDADA - CONCESSIONÁRIAS\n`;
    memoria += `OM Favorecida: ${organizacao} (UG: ${formatCodug(ug)})\n`;
    memoria += `OM Destino Recurso: ${om_detentora} (UG: ${formatCodug(ug_detentora)})\n`;
    memoria += `Fase da Atividade: ${group.fase_atividade || 'Não Informada'}\n`;
    memoria += `Período: ${dias_operacao} dias | Efetivo: ${efetivo} militares\n\n`;
    
    memoria += `DETALHAMENTO POR CATEGORIA:\n`;
    
    records.forEach((registro) => {
        const totalUnidades = Number(registro.valor_unitario) > 0 
            ? Number(registro.valor_total) / Number(registro.valor_unitario)
            : 0;
        const unidadeCusto = registro.detalhamento?.match(/\((.*?)\/dia\)/)?.[1] || 'unidade';
        
        memoria += `\n--- ${registro.categoria.toUpperCase()} ---\n`;
        memoria += `Concessionária: ${registro.detalhamento?.split(' - ')[0] || 'Não Informada'}\n`;
        memoria += `Consumo/Pessoa/Dia: ${registro.consumo_pessoa_dia} ${unidadeCusto}/dia\n`;
        memoria += `Custo Unitário: ${formatCurrency(registro.valor_unitario)} / ${unidadeCusto}\n`;
        memoria += `Total de Unidades Solicitadas: ${totalUnidades.toFixed(2)} ${unidadeCusto}\n`;
        memoria += `Valor Total: ${formatCurrency(registro.valor_total)}\n`;
    });
    
    memoria += `\n==================================================\n`;
    memoria += `VALOR TOTAL GERAL (ND 33.90.39): ${formatCurrency(totalND39)}\n`;
    
    return memoria;
};