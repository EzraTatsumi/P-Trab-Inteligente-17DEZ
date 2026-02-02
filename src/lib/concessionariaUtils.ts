import { Tables } from "@/integrations/supabase/types";
import { DiretrizConcessionaria, CategoriaConcessionaria } from "@/types/diretrizesConcessionaria";
import { formatCurrency, formatCodug } from "./formatUtils";

export type ConcessionariaRegistro = Tables<'concessionaria_registros'>;

// Tipo para o item selecionado no diálogo (Diretriz completa)
export interface DiretrizSelection extends DiretrizConcessionaria {
    // A diretriz completa já contém todas as informações necessárias (consumo, custo, etc.)
}

// Tipo para o registro consolidado (agrupado por OM, UG, Dias, Efetivo, Fase)
export interface ConsolidatedConcessionariaRecord {
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    records: ConcessionariaRegistro[];
    totalGeral: number;
    totalND39: number;
}

/**
 * Calcula o valor total para um registro de concessionária.
 * Valor Total = Efetivo * Dias Operação * Consumo Pessoa Dia * Custo Unitário
 */
export const calculateConcessionariaTotal = (
    efetivo: number, 
    dias_operacao: number, 
    consumo_pessoa_dia: number, 
    custo_unitario: number
): number => {
    if (efetivo <= 0 || dias_operacao <= 0 || consumo_pessoa_dia <= 0 || custo_unitario <= 0) {
        return 0;
    }
    // Arredonda para duas casas decimais
    return Math.round((efetivo * dias_operacao * consumo_pessoa_dia * custo_unitario) * 100) / 100;
};

/**
 * Gera a memória de cálculo individual para um registro de concessionária.
 * (Usado para staging/revisão e exibição final)
 */
export const generateConcessionariaMemoriaCalculo = (registro: ConcessionariaRegistro): string => {
    const { organizacao, ug, om_detentora, ug_detentora, dias_operacao, efetivo, categoria, valor_unitario, consumo_pessoa_dia, valor_total, detalhamento } = registro;
    
    const nomeConcessionaria = detalhamento?.split(': ')[1] || 'Detalhe não disponível';
    const unidade = categoria === 'Água/Esgoto' ? 'm³' : 'kWh';
    
    let memoria = `SOLICITAÇÃO DE RECURSOS PARA PAGAMENTO DE CONCESSIONÁRIA\n`;
    memoria += `OM Favorecida: ${organizacao} (UG: ${formatCodug(ug)})\n`;
    memoria += `OM Destino Recurso: ${om_detentora} (UG: ${formatCodug(ug_detentora)})\n`;
    memoria += `Categoria: ${categoria} | Concessionária: ${nomeConcessionaria}\n`;
    memoria += `Período: ${dias_operacao} dias | Efetivo: ${efetivo} militares\n\n`;
    
    memoria += `CÁLCULO (ND 33.90.39):\n`;
    memoria += `Efetivo (${efetivo}) x Dias (${dias_operacao}) x Consumo/Pessoa/Dia (${consumo_pessoa_dia} ${unidade}) x Custo Unitário (${formatCurrency(valor_unitario)}/${unidade})\n`;
    memoria += `Total: ${formatCurrency(valor_total)}\n`;
    
    return memoria;
};