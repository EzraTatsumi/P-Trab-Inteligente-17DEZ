import { formatCurrency, formatNumber, formatCodug } from "./formatUtils";
import { Tables } from "@/integrations/supabase/types";

// Tipos de destino para fins de pagamento de diária
export type DestinoDiaria = 'bsb_capitais_especiais' | 'demais_capitais' | 'demais_dslc';

// Configuração dos postos/graduações e seus campos correspondentes nas diretrizes
export const DIARIA_RANKS_CONFIG = [
  { key: 'of_gen', label: 'Of Gen', fieldPrefix: 'diaria_of_gen' },
  { key: 'of_sup', label: 'Of Sup', fieldPrefix: 'diaria_of_sup' },
  { key: 'of_int_sgt', label: 'Of Int/Sub/Asp Of/ST/Sgt', fieldPrefix: 'diaria_of_int_sgt' },
  { key: 'demais_pracas', label: 'Demais Praças', fieldPrefix: 'diaria_demais_pracas' },
];

// Tipo para armazenar as quantidades de militares por posto/graduação
export type QuantidadesPorPosto = Record<typeof DIARIA_RANKS_CONFIG[number]['key'], number>;

// Tipo para os dados de diária (simplificado para o cálculo)
interface DiariaData {
  dias_operacao: number;
  destino: DestinoDiaria;
  nr_viagens: number;
  local_atividade: string;
  quantidades_por_posto: QuantidadesPorPosto;
  organizacao: string; // OM de Destino
  ug: string; // UG de Destino
  is_aereo: boolean; // NOVO CAMPO: Indica se o deslocamento é aéreo
}

// Tipo para as diretrizes operacionais (valores unitários)
type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

/**
 * Determina a preposição correta ('do' ou 'da') para o nome da OM.
 */
const getOmPreposition = (omName: string): 'do' | 'da' => {
    if (!omName) return 'do';
    if (omName.includes('ª') || omName.toUpperCase().includes('RM')) {
        return 'da';
    }
    return 'do';
};

/**
 * Obtém o valor unitário da diária com base no posto/graduação e destino.
 */
const getValorUnitario = (
    rankKey: string, 
    destino: DestinoDiaria, 
    diretrizes: Partial<DiretrizOperacional>
): number => {
    const rankConfig = DIARIA_RANKS_CONFIG.find(r => r.key === rankKey);
    if (!rankConfig) return 0;

    let fieldSuffix: 'bsb' | 'capitais' | 'demais';
    
    switch (destino) {
        case 'bsb_capitais_especiais':
            fieldSuffix = 'bsb';
            break;
        case 'demais_capitais':
            fieldSuffix = 'capitais';
            break;
        case 'demais_dslc':
            fieldSuffix = 'demais';
            break;
        default:
            return 0;
    }
    
    const fieldKey = `${rankConfig.fieldPrefix}_${fieldSuffix}` as keyof DiretrizOperacional;
    return Number(diretrizes[fieldKey] || 0);
};

/**
 * Calcula o custo total da diária e da taxa de embarque.
 * O total geral é consolidado na ND 33.90.15.
 */
export const calculateDiariaTotals = (
    data: DiariaData, 
    diretrizes: Partial<DiretrizOperacional>
): { 
    totalDiariaBase: number, // Valor da diária sem taxa de embarque
    totalTaxaEmbarque: number, 
    totalGeral: number, // Total consolidado (ND 33.90.15)
    totalMilitares: number,
    calculosPorPosto: { posto: string, quantidade: number, valorUnitario: number, custoTotal: number }[]
} => {
    const { dias_operacao, destino, nr_viagens, quantidades_por_posto, is_aereo } = data;
    
    // 1. Cálculo dos dias de pagamento (dias_operacao - 0.5)
    const diasPagamento = Math.max(0, dias_operacao - 0.5);
    
    let totalDiariaBase = 0;
    let totalMilitares = 0;
    const calculosPorPosto: { posto: string, quantidade: number, valorUnitario: number, custoTotal: number }[] = [];

    DIARIA_RANKS_CONFIG.forEach(rank => {
        const quantidade = quantidades_por_posto[rank.key] || 0;
        if (quantidade > 0) {
            const valorUnitario = getValorUnitario(rank.key, destino, diretrizes);
            
            // Fórmula: (Nr militares x Custo/dia/localidade) x (Nr dias de operação - 0,5 dia) x Nr Viagens
            const custoTotal = quantidade * valorUnitario * diasPagamento * nr_viagens;
            
            totalDiariaBase += custoTotal;
            totalMilitares += quantidade;
            
            calculosPorPosto.push({
                posto: rank.label,
                quantidade,
                valorUnitario,
                custoTotal,
            });
        }
    });
    
    // 2. Cálculo da Taxa de Embarque
    let totalTaxaEmbarque = 0;
    if (is_aereo) { // Apenas calcula se for deslocamento aéreo
        const taxaEmbarqueUnitario = Number(diretrizes.taxa_embarque || 0);
        totalTaxaEmbarque = totalMilitares * taxaEmbarqueUnitario * nr_viagens;
    }
    
    // 3. Consolidação: Total Geral (ND 33.90.15) = Diária Base + Taxa de Embarque
    const totalGeral = totalDiariaBase + totalTaxaEmbarque;

    return {
        totalDiariaBase,
        totalTaxaEmbarque,
        totalGeral,
        totalMilitares,
        calculosPorPosto,
    };
};

/**
 * Gera a memória de cálculo detalhada para o registro de diárias.
 */
export const generateDiariaMemoriaCalculo = (
    data: DiariaData, 
    diretrizes: Partial<DiretrizOperacional>,
    calculos: ReturnType<typeof calculateDiariaTotals>
): string => {
    const { dias_operacao, destino, nr_viagens, local_atividade, organizacao, ug, is_aereo } = data;
    const { totalDiariaBase, totalTaxaEmbarque, totalGeral, totalMilitares, calculosPorPosto } = calculos;
    
    const referenciaLegal = diretrizes.diaria_referencia_legal || 'Lei/Portaria [NÚMERO]';
    
    const militarPlural = totalMilitares === 1 ? 'militar' : 'militares';
    const viagemPlural = nr_viagens === 1 ? 'viagem' : 'viagens';
    const diaPlural = dias_operacao === 1 ? 'dia' : 'dias';
    
    const omPreposition = getOmPreposition(organizacao);
    
    // Mapeamento do destino para o rótulo
    let destinoLabel = '';
    switch (destino) {
        case 'bsb_capitais_especiais': destinoLabel = 'Dslc BSB/MAO/RJ/SP'; break;
        case 'demais_capitais': destinoLabel = 'Dslc demais capitais'; break;
        case 'demais_dslc': destinoLabel = 'Demais Dslc'; break;
    }
    
    // CABEÇALHO (ND 33.90.15)
    const header = `33.90.15 Custeio com Diárias de ${totalMilitares} ${militarPlural} ${omPreposition} ${organizacao}, para ${nr_viagens} ${viagemPlural} com duração de ${dias_operacao} ${diaPlural} em ${local_atividade}.`;

    let detalhamentoValores = '';
    let detalhamentoFormula = '';
    let totalFormula = 0;
    
    calculosPorPosto.forEach(calc => {
        const militaresPlural = calc.quantidade === 1 ? 'mil.' : 'militares';
        const diasPagamento = Math.max(0, dias_operacao - 0.5);
        
        // Detalhamento de Valores Unitários
        detalhamentoValores += `- ${calc.posto} R$ ${formatNumber(calc.valorUnitario, 2)} / dia Op.\n`;
        
        // Detalhamento da Fórmula
        // Ex: (3 Of Sup x R$ 450,00/dia) x 4,5 dias x 1 viagem = R$ 6.075,00.
        const formulaPart1 = `(${calc.quantidade} ${calc.posto} x ${formatCurrency(calc.valorUnitario)}/dia)`;
        const formulaPart2 = `${formatNumber(Math.max(0, dias_operacao - 0.5), 1)} dias x ${nr_viagens} viagem${nr_viagens === 1 ? '' : 'ns'}`;
        
        detalhamentoFormula += `- ${formulaPart1} x ${formulaPart2} = ${formatCurrency(calc.custoTotal)}.\n`;
        totalFormula += calc.custoTotal;
    });
    
    const taxaEmbarqueUnitario = Number(diretrizes.taxa_embarque || 0);
    
    let detalhamentoTaxa = '';
    if (is_aereo) {
        detalhamentoTaxa = `
- Taxa de Embarque (Componente ND 33.90.15): ${formatCurrency(taxaEmbarqueUnitario)}/pessoa.
- Cálculo Taxa: ${totalMilitares} militares x ${formatCurrency(taxaEmbarqueUnitario)} x ${nr_viagens} viagens = ${formatCurrency(totalTaxaEmbarque)}.
`;
    } else {
        detalhamentoTaxa = `
- Deslocamento Terrestre/Fluvial: Não há previsão legal para pagamento de Taxa de Embarque.
`;
    }
    
    // CORRIGIDO: Rótulo da ND para Diária
    return `${header}

OM Destino Recurso: ${organizacao} (UG: ${formatCodug(ug)})

Cálculo, segundo ${referenciaLegal}:
- Para ${destinoLabel} considera-se: 
${detalhamentoValores.trim()}

Fórmula Diária Base: (Nr militares x Custo/dia/localidade) x (Nr dias de operação - 0,5 dia) x Nr Viagens.
${detalhamentoFormula.trim()}

Total Diária Base: ${formatCurrency(totalDiariaBase)}.
${detalhamentoTaxa.trim()}

Total Geral (ND 33.90.15): ${formatCurrency(totalGeral)}.`;
};