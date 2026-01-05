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

/**
 * Função para formatar as fases de forma natural no texto
 */
export const formatFasesParaTexto = (faseCSV: string | undefined | null): string => {
  if (!faseCSV) return 'operação';
  
  const fases = faseCSV.split(';').map(f => f.trim()).filter(f => f);
  
  if (fases.length === 0) return 'operação';
  if (fases.length === 1) return fases[0];
  if (fases.length === 2) return `${fases[0]} e ${fases[1]}`;
  
  const ultimaFase = fases[fases.length - 1];
  const demaisFases = fases.slice(0, -1).join(', ');
  return `${demaisFases} e ${ultimaFases}`;
};

/**
 * Conta o número de fases distintas.
 */
const countFases = (faseCSV: string | undefined | null): number => {
    if (!faseCSV) return 0;
    return faseCSV.split(';').map(f => f.trim()).filter(f => f).length;
};


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
  fase_atividade: string; // Adicionado para o cálculo de memória
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
    const { dias_operacao, destino, nr_viagens, local_atividade, organizacao, ug, is_aereo, fase_atividade } = data;
    const { totalDiariaBase, totalTaxaEmbarque, totalGeral, totalMilitares, calculosPorPosto } = calculos;
    
    const referenciaLegal = diretrizes.diaria_referencia_legal || 'Lei/Portaria [NÚMERO]';
    
    // Lógica de singular/plural
    const militarText = totalMilitares === 1 ? 'militar' : 'militares';
    const viagemText = nr_viagens === 1 ? 'viagem' : 'viagens';
    const diaText = dias_operacao === 1 ? 'dia' : 'dias';
    
    const omPreposition = getOmPreposition(organizacao);
    const faseFormatada = formatFasesParaTexto(fase_atividade);
    
    // Determina se é "fase de" ou "fases de"
    const nrFases = countFases(fase_atividade);
    const faseConcordancia = nrFases <= 1 ? 'fase de' : 'fases de';
    
    // Mapeamento do destino para o rótulo
    let destinoLabel = '';
    switch (destino) {
        case 'bsb_capitais_especiais': destinoLabel = 'Dslc BSB/MAO/RJ/SP'; break;
        case 'demais_capitais': destinoLabel = 'Dslc demais capitais'; break;
        case 'demais_dslc': destinoLabel = 'Demais Dslc'; break;
    }
    
    // CABEÇALHO
    const header = `33.90.15 - Custeio com Diárias de ${totalMilitares} ${militarText} ${omPreposition} ${organizacao}, para ${nr_viagens} ${viagemText} com duração de ${dias_operacao} ${diaText} em ${local_atividade}, durante a ${faseConcordancia} ${faseFormatada}.`;

    let detalhamentoValores = '';
    let detalhamentoFormulaDiarias = '';
    
    const taxaEmbarqueUnitario = Number(diretrizes.taxa_embarque || 0);
    
    // 1. Detalhamento de Valores Unitários (incluindo Taxa de Embarque)
    if (is_aereo) {
        detalhamentoValores += `- Taxa de Embarque: ${formatCurrency(taxaEmbarqueUnitario)}/viagem.\n`;
    }

    calculosPorPosto.forEach(calc => {
        // 1. Detalhamento de Valores Unitários
        detalhamentoValores += `- ${calc.posto}: ${formatCurrency(calc.valorUnitario)}/dia.\n`;
        
        // 2. Detalhamento da Fórmula das Diárias
        const formulaPart1 = `(${calc.quantidade} ${calc.posto} x ${formatCurrency(calc.valorUnitario)}/dia)`;
        const formulaPart2 = `${formatNumber(Math.max(0, dias_operacao - 0.5), 1)} dias x ${nr_viagens} viagem${nr_viagens === 1 ? '' : 'ns'}`;
        
        detalhamentoFormulaDiarias += `- ${formulaPart1} x ${formulaPart2} = ${formatCurrency(calc.custoTotal)}.\n`;
    });
    
    
    let detalhamentoTaxaCalculo = '';
    if (is_aereo) {
        detalhamentoTaxaCalculo = `
- Efetivo x Valor da Taxa de Embarque x Quantidade de Viagens = ${formatCurrency(totalTaxaEmbarque)}.
`;
    } else {
        detalhamentoTaxaCalculo = `
- Deslocamento Terrestre/Fluvial: Não há previsão legal para pagamento de Taxa de Embarque.
`;
    }
    
    // NOVO FORMATO DE INTRODUÇÃO AO CÁLCULO
    const introducaoCalculo = `Cálculo, segundo ${referenciaLegal}, para ${destinoLabel}, considera-se:`;

    return `${header}

${introducaoCalculo}
${detalhamentoValores.trim()}

Fórmula da Taxa de Embarque: Efetivo x Valor da Taxa de Embarque x Quantidade de Viagens.
Fórmula das Diárias: (Efetivo x Custo/dia/localidade) x (Nr Dias - 0,5 dia) x Nr Viagens.

${is_aereo ? detalhamentoTaxaCalculo.trim() : ''}
${detalhamentoFormulaDiarias.trim()}

Total Diária Base: ${formatCurrency(totalDiariaBase)}.
${detalhamentoTaxaCalculo.trim()}

Total Geral (ND 33.90.15): ${formatCurrency(totalGeral)}.`;
};