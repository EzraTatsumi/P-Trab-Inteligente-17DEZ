import { formatCurrency, formatCodug, formatNumber } from "./formatUtils";
import { formatFasesParaTexto } from "./diariaUtils"; 

// Tolerância para comparação de valores monetários
const ND_TOLERANCE = 0.01;

// Type for Suprimento de Fundos data (usando a estrutura de Verba Operacional como base)
export interface SuprimentoFundosRegistro {
  dias_operacao: number;
  quantidade_equipes: number;
  valor_total_solicitado: number;
  organizacao: string; // OM Favorecida
  ug: string; // UG Favorecida
  om_detentora: string | null; // OM Destino do Recurso
  ug_detentora: string | null; // UG Destino do Recurso
  fase_atividade: string;
  valor_nd_30: number;
  valor_nd_39: number;
  // Campos de Detalhamento (armazenados no detalhamento_customizado da DB)
  objeto_aquisicao: string;
  objeto_contratacao: string;
  proposito: string;
  finalidade: string;
  local: string;
  tarefa: string;
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
 * Calcula o custo total do Suprimento de Fundos.
 * O total geral é a soma das NDs alocadas.
 */
export const calculateSuprimentoFundosTotals = (
    data: SuprimentoFundosRegistro
): { 
    totalGeral: number,
    totalND30: number,
    totalND39: number,
} => {
    // A lógica de cálculo de NDs é feita no frontend (useNDAllocation)
    const totalGeral = data.valor_nd_30 + data.valor_nd_39;
    
    return {
        totalGeral,
        totalND30: data.valor_nd_30,
        totalND39: data.valor_nd_39,
    };
};

/**
 * Gera a memória de cálculo detalhada para o registro de Suprimento de Fundos.
 */
export const generateSuprimentoFundosMemoriaCalculo = (
    data: SuprimentoFundosRegistro
): string => {
    const { 
        dias_operacao, 
        quantidade_equipes, 
        organizacao, 
        ug,
        om_detentora,
        ug_detentora,
        fase_atividade,
        valor_nd_30,
        valor_nd_39,
        objeto_aquisicao,
        objeto_contratacao,
        proposito,
        finalidade,
        local,
        tarefa,
    } = data;
    
    const omPreposition = getOmPreposition(organizacao);
    const faseFormatada = formatFasesParaTexto(fase_atividade);
    
    const militarText = quantidade_equipes === 1 ? 'militar' : 'militares';
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
    
    // CABEÇALHO
    const header = `${ndPrefix} - Solicitação de Suprimento de Fundos para ${quantidade_equipes} ${militarText} ${omPreposition} ${organizacao}, durante ${dias_operacao} ${diaText} de ${faseFormatada}.`;

    // Detalhamento
    const detalhamento = `
OM Favorecida: ${organizacao} (UG: ${formatCodug(ug)})
OM Destino Recurso: ${om_detentora} (UG: ${formatCodug(ug_detentora)})

Detalhes da Aplicação:
- Objeto de Aquisição (Material): ${objeto_aquisicao}
- Objeto de Contratação (Serviço): ${objeto_contratacao}
- Propósito: ${proposito}
- Finalidade: ${finalidade}
- Local: ${local}
- Tarefa: ${tarefa}

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valor_nd_30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valor_nd_39)}

Valor Total Solicitado: ${formatCurrency(valorTotal)}.`;

    return header + detalhamento;
};