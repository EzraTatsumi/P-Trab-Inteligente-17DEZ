import { Tables } from "@/integrations/supabase/types";
import { DiretrizConcessionaria, CategoriaConcessionaria } from "@/types/diretrizesConcessionaria";
import { formatCurrency, formatCodug, formatNumber } from "./formatUtils";

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
 * @param registro O registro de concessionária (ConcessionariaRegistro).
 * @param diretrizDetails Os detalhes da diretriz (DiretrizConcessionaria) para obter fontes e nomes.
 */
export const generateConcessionariaMemoriaCalculo = (
    registro: ConcessionariaRegistro,
    diretrizDetails?: DiretrizConcessionaria
): string => {
    const categoria = registro.categoria;
    const omFavorecida = registro.organizacao;
    const omDestino = registro.om_detentora;
    const efetivo = registro.efetivo;
    const diasOperacao = registro.dias_operacao;
    const faseAtividade = registro.fase_atividade || 'Não Informada';
    
    // Usar dados do registro se os detalhes da diretriz não estiverem disponíveis (fallback)
    const nomeConcessionaria = diretrizDetails?.nome_concessionaria || registro.detalhamento?.split(' - ')[1] || 'N/A';
    const consumoPessoaDia = diretrizDetails?.consumo_pessoa_dia || registro.consumo_pessoa_dia || 0;
    const unidadeCusto = diretrizDetails?.unidade_custo || (categoria === 'Água/Esgoto' ? 'm³' : 'kWh');
    const custoUnitario = diretrizDetails?.custo_unitario || registro.valor_unitario || 0;
    const fonteConsumo = diretrizDetails?.fonte_consumo || 'Não Informada';
    const fonteCusto = diretrizDetails?.fonte_custo || 'Não Informada';
    
    const total = calculateConcessionariaTotal(
        efetivo,
        diasOperacao,
        consumoPessoaDia,
        custoUnitario
    );
    
    // Formatação dos valores
    const formattedConsumo = formatNumber(consumoPessoaDia, 2);
    const formattedCusto = formatCurrency(custoUnitario);
    const formattedTotal = formatCurrency(total);
    
    // 1. Cabeçalho (ND e Descrição)
    let memoria = `33.90.39 - Pagamento de Concessionária de ${categoria} do ${omDestino} para receber ${efetivo} militares do ${omFavorecida}, durante ${diasOperacao} dias de ${faseAtividade}.\n\n`;
    
    // 2. Detalhes do Cálculo
    memoria += `Cálculo:\n`;
    memoria += `- Concessionária: ${nomeConcessionaria}\n`;
    memoria += `- Consumo pessoa/dia: ${formattedConsumo} ${unidadeCusto}/dia, segundo ${fonteConsumo}.\n`;
    memoria += `- Custo: ${formattedCusto} / ${unidadeCusto}, segundo ${fonteCusto}.\n\n`;
    
    // 3. Fórmula
    memoria += `Fórmula: (Nr milirares x Consumo/dia x Custo/unidade) x Nr dias de operação.\n`;
    
    // 4. Aplicação da Fórmula
    memoria += `- (${efetivo} militares x ${formattedConsumo} ${unidadeCusto}/dia x ${formattedCusto} /${unidadeCusto}) x ${diasOperacao} dias = ${formattedTotal}.\n\n`;
    
    // 5. Total
    memoria += `Total: ${formattedTotal}.`;
    
    return memoria;
};

/**
 * Função de compatibilidade (mantida vazia, pois a consolidação foi removida).
 */
export const generateConsolidatedConcessionariaMemoriaCalculo = (
    group: ConsolidatedConcessionariaRecord
): string => {
    // Esta função não deve mais ser usada, pois a memória é gerada por registro individual.
    return "Memória de cálculo consolidada descontinuada. Use a memória individual por diretriz.";
};