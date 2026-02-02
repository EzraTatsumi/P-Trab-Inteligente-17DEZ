import { Tables } from "@/integrations/supabase/types";
import { DiretrizConcessionaria, CategoriaConcessionaria } from "@/types/diretrizesConcessionaria";
import { formatCurrency, formatCodug, formatNumber } from "./formatUtils";

export type ConcessionariaRegistro = Tables<'concessionaria_registros'>;

// Tipo para o registro estendido com detalhes da diretriz (necessário para a memória)
// Deve estender ConcessionariaRegistro para incluir todas as propriedades da tabela
export interface ConcessionariaRegistroComDiretriz extends ConcessionariaRegistro {
    nome_concessionaria: string;
    unidade_custo: string;
    fonte_consumo: string | null;
    fonte_custo: string | null;
}

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
    records: ConcessionariaRegistroComDiretriz[]; // Usando o tipo estendido
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
 * Determina o artigo/preposição correto ('do' ou 'da') baseado no nome da OM.
 * Prioriza indicadores ordinais (º/ª).
 */
const getPrepositionArticle = (omName: string): 'do' | 'da' => {
    const trimmedOm = omName.trim();
    
    // 1. Verifica indicadores ordinais (º/ª)
    if (/\d+º/.test(trimmedOm)) {
        return 'do';
    }
    if (/\d+ª/.test(trimmedOm)) {
        return 'da';
    }
    
    // 2. Verifica nomes femininos comuns (fallback)
    const lowerOm = trimmedOm.toLowerCase();
    if (lowerOm.includes('companhia') || lowerOm.includes('base') || lowerOm.includes('escola') || lowerOm.includes('diretoria')) {
        return 'da';
    }
    
    // 3. Padrão para masculino
    return 'do';
};

/**
 * Gera a memória de cálculo individual para um registro de concessionária.
 * (Usado principalmente para staging/revisão)
 */
export const generateConcessionariaMemoriaCalculo = (registro: ConcessionariaRegistroComDiretriz): string => {
    // Agora, todas as propriedades da tabela (organizacao, om_detentora, etc.) estão disponíveis diretamente
    const { organizacao, om_detentora, dias_operacao, efetivo, categoria, valor_unitario, consumo_pessoa_dia, valor_total, nome_concessionaria, unidade_custo, fonte_consumo, fonte_custo, fase_atividade } = registro;
    
    // Garantir que os campos críticos não sejam undefined/null
    const nomeConcessionaria = nome_concessionaria || 'Não Informado';
    const unidadeCusto = unidade_custo || 'unidade';
    
    // Variáveis de concordância
    const categoriaNome = categoria === 'Água/Esgoto' ? 'Água/Esgoto' : 'Energia Elétrica';
    
    const artigoOmFavorecida = getPrepositionArticle(organizacao);
    const artigoOmDestino = getPrepositionArticle(om_detentora || ''); // om_detentora pode ser null no DB, mas deve ser string aqui
    
    const militaresText = efetivo === 1 ? 'militar' : 'militares';
    const diasText = dias_operacao === 1 ? 'dia' : 'dias';
    
    // 1. Cabeçalho (33.90.39)
    let memoria = `33.90.39 - Pagamento de Concessionária de ${categoriaNome} ${artigoOmFavorecida} ${organizacao} para atender ${efetivo} ${militaresText} ${artigoOmDestino} ${om_detentora} durante ${dias_operacao} ${diasText} de ${fase_atividade}.\n`;
    
    // 2. Detalhamento do Cálculo
    memoria += `\nCálculo:\n`;
    memoria += `- Concessionária: ${nomeConcessionaria}\n`;
    memoria += `- Consumo pessoa/dia: ${formatNumber(consumo_pessoa_dia, 2)} ${unidadeCusto}/dia, segundo ${fonte_consumo || 'Não Informado'}.\n`;
    memoria += `- Custo: ${formatCurrency(valor_unitario)}/${unidadeCusto}, segundo ${fonte_custo || 'Não Informado'}.\n`;
    
    // 3. Fórmula e Aplicação
    memoria += `\nFórmula: (Efetivo x Consumo/dia x Custo) x Nr dias de Atividade.\n`;
    // Aplicação da fórmula: - ( <Efetivo> militar/es x <consumo>/dia x <custo>/m3 ou kWh) x <Período> dia/s = <Total>.
    memoria += `- (${efetivo} ${militaresText} x ${formatNumber(consumo_pessoa_dia, 2)} ${unidadeCusto}/dia x ${formatCurrency(valor_unitario)} /${unidadeCusto}) x ${dias_operacao} ${diasText} = ${formatCurrency(valor_total)}.\n`;
    
    // 4. Total
    memoria += `\nTotal: ${formatCurrency(valor_total)}.\n`;
    
    return memoria;
};

/**
 * Gera a memória de cálculo consolidada para um grupo de registros de concessionária.
 */
export const generateConsolidatedConcessionariaMemoriaCalculo = (group: ConsolidatedConcessionariaRecord): string => {
    const { organizacao, ug, om_detentora, ug_detentora, dias_operacao, efetivo, records, totalGeral, fase_atividade } = group;
    
    let memoria = ``;
    
    records.forEach(r => {
        const categoria = r.categoria;
        
        // Garantir que os campos críticos não sejam undefined/null
        const nomeConcessionaria = r.nome_concessionaria || 'Não Informado';
        const unidadeCusto = r.unidade_custo || 'unidade';
        
        const consumo = Number(r.consumo_pessoa_dia);
        const custo = Number(r.valor_unitario);
        const fonteConsumo = r.fonte_consumo || 'Não Informado';
        const fonteCusto = r.fonte_custo || 'Não Informado';
        const total = Number(r.valor_total);
        
        // Variáveis de concordância (dentro do loop)
        const categoriaNome = categoria === 'Água/Esgoto' ? 'Água/Esgoto' : 'Energia Elétrica';
        const militaresText = efetivo === 1 ? 'militar' : 'militares';
        const diasText = dias_operacao === 1 ? 'dia' : 'dias';
        
        const artigoOmFavorecida = getPrepositionArticle(organizacao);
        const artigoOmDestino = getPrepositionArticle(om_detentora);
        
        // Cabeçalho individual (para detalhamento) - Ajustado
        memoria += `33.90.39 - Pagamento de Concessionária de ${categoriaNome} ${artigoOmFavorecida} ${organizacao} para atender ${efetivo} ${militaresText} ${artigoOmDestino} ${om_detentora} durante ${dias_operacao} ${diasText} de ${fase_atividade}.\n`;
        
        memoria += `\nCálculo:\n`;
        memoria += `- Concessionária: ${nomeConcessionaria}\n`;
        memoria += `- Consumo pessoa/dia: ${formatNumber(consumo, 2)} ${unidadeCusto}/dia, segundo ${fonteConsumo}.\n`;
        memoria += `- Custo: ${formatCurrency(custo)}/${unidadeCusto}, segundo ${fonteCusto}.\n`;
        
        memoria += `\nFórmula: (Efetivo x Consumo/dia x Custo) x Nr dias de Atividade.\n`;
        memoria += `- (${efetivo} ${militaresText} x ${formatNumber(consumo, 2)} ${unidadeCusto}/dia x ${formatCurrency(custo)} /${unidadeCusto}) x ${dias_operacao} ${diasText} = ${formatCurrency(total)}.\n`;
        memoria += `\nTotal: ${formatCurrency(total)}.\n`;
    });
    
    return memoria;
};