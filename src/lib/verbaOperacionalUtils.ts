import { formatCurrency, formatCodug, formatNumber } from "./formatUtils";
import { formatFasesParaTexto } from "./diariaUtils"; 

// Tolerância para comparação de valores monetários
const ND_TOLERANCE = 0.01;

// Type for Verba Operacional data
interface VerbaOperacionalData {
  dias_operacao: number;
  quantidade_equipes: number;
  valor_total_solicitado: number;
  organizacao: string;
  ug: string;
  om_detentora: string | null;
  ug_detentora: string | null;
  fase_atividade: string;
  valor_nd_30: number;
  valor_nd_39: number;
}

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
 * Calcula o custo total da verba operacional.
 * O total geral é a soma das NDs alocadas.
 */
export const calculateVerbaOperacionalTotals = (
    data: VerbaOperacionalData
): { 
    totalGeral: number,
    totalND30: number,
    totalND39: number,
} => {
    const totalGeral = data.valor_nd_30 + data.valor_nd_39;
    
    return {
        totalGeral,
        totalND30: data.valor_nd_30,
        totalND39: data.valor_nd_39,
    };
};

/**
 * Gera a memória de cálculo detalhada para o registro de Verba Operacional.
 */
export const generateVerbaOperacionalMemoriaCalculo = (
    data: VerbaOperacionalData
): string => {
    const { 
        dias_operacao, 
        quantidade_equipes, 
        organizacao, 
        ug, 
        fase_atividade,
        valor_nd_30,
        valor_nd_39,
        om_detentora,
        ug_detentora,
    } = data;
    
    const omPreposition = getOmPreposition(organizacao);
    const faseFormatada = formatFasesParaTexto(fase_atividade);
    
    const equipeText = quantidade_equipes === 1 ? 'equipe' : 'equipes';
    const diaText = dias_operacao === 1 ? 'dia' : 'dias';
    
    const valorTotal = valor_nd_30 + valor_nd_39;
    
    // --- Lógica para determinar o prefixo ND dinâmico ---
    const isND30Active = valor_nd_30 > ND_TOLERANCE;
    const isND39Active = valor_nd_39 > ND_TOLERANCE;
    
    let ndPrefix = "";
    if (isND30Active && isND39Active) {
        ndPrefix = "33.90.30 / 33.90.39";
    } else if (isND30Active) {
        ndPrefix = "33.90.30";
    } else if (isND39Active) {
        ndPrefix = "33.90.39";
    } else {
        ndPrefix = "(Não Alocado)";
    }
    // --- Fim Lógica ND ---
    
    const despesasDescricao = "operando fora da sede (hospedagem, alimentação, combustível, aluguel de viatura, manutenção de viatura e serviços diversos).";
    
    // CABEÇALHO
    const header = `${ndPrefix} - Solicitação de Verba Operacional para ${quantidade_equipes} ${equipeText} ${omPreposition} ${organizacao}, durante ${dias_operacao} ${diaText} de ${faseFormatada}, ${despesasDescricao}`;

    // Detalhamento simplificado
    const detalhamento = `
OM Favorecida: ${organizacao} (UG: ${formatCodug(ug)})
OM Destino Recurso: ${om_detentora} (UG: ${formatCodug(ug_detentora)})

Alocação:
- ND 33.90.30 (Material/Serviço): ${formatCurrency(valor_nd_30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valor_nd_39)}

Valor Total Alocado: ${formatCurrency(valorTotal)}.
`;

    return header + detalhamento;
};