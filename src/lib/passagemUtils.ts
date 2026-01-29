import { formatCurrency, formatCodug, formatNumber } from "./formatUtils";
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// Tipo de registro da DB
export type PassagemRegistro = TablesInsert<'passagem_registros'> & { id?: string };

// Tipo de dados para o formulário (inclui campos de display)
export interface PassagemForm {
    om_favorecida: string;
    ug_favorecida: string;
    dias_operacao: number;
    fase_atividade: string;
    
    // Dados do Trecho Selecionado (OM Detentora é a OM Contratante)
    om_detentora: string;
    ug_detentora: string;
    diretriz_id: string;
    trecho_id: string;
    origem: string;
    destino: string;
    tipo_transporte: string;
    is_ida_volta: boolean;
    valor_unitario: number;
    
    // Quantidade
    quantidade_passagens: number;
}

/**
 * Calcula o custo total de uma solicitação de passagem.
 * @param data Dados da passagem.
 * @returns Objeto com totais calculados.
 */
export const calculatePassagemTotals = (data: PassagemForm) => {
    const valorUnitario = data.valor_unitario || 0;
    const quantidade = data.quantidade_passagens || 0;
    
    // O valor total é o valor unitário do trecho * a quantidade de passagens
    const valorTotal = valorUnitario * quantidade;
    
    // Passagens são sempre ND 33
    const valorND33 = valorTotal;

    return {
        totalGeral: valorTotal,
        totalND33: valorND33,
    };
};

/**
 * Formats the activity phases from a semicolon-separated string into a readable text format.
 */
const formatFasesParaTexto = (faseCSV: string | null | undefined): string => {
  if (!faseCSV) return 'operação';
  
  const fases = faseCSV.split(';').map(f => f.trim()).filter(f => f);
  
  if (fases.length === 0) return 'operação';
  if (fases.length === 1) return fases[0];
  if (fases.length === 2) return `${fases[0]} e ${fases[1]}`;
  
  const ultimaFase = fases[fases.length - 1];
  const demaisFases = fases.slice(0, -1).join(', ');
  return `${demaisFases} e ${ultimaFase}`;
};

/**
 * Helper function to determine 'do' or 'da' based on OM name.
 */
const getOmArticle = (omName: string): string => {
    if (omName.includes('ª')) {
        return 'da';
    }
    return 'do';
};

/**
 * Gera a memória de cálculo detalhada para o registro de Passagens.
 */
export const generatePassagemMemoriaCalculo = (data: PassagemRegistro | PassagemForm): string => {
    const { 
        organizacao, ug, om_detentora, ug_detentora, 
        dias_operacao, fase_atividade, 
        origem, destino, tipo_transporte, is_ida_volta, 
        valor_unitario, quantidade_passagens, valor_total, valor_nd_33
    } = data;
    
    const faseFormatada = formatFasesParaTexto(fase_atividade);
    const omArticle = getOmArticle(organizacao);
    const diaPlural = dias_operacao === 1 ? 'dia' : 'dias';
    const passagemPlural = quantidade_passagens === 1 ? 'passagem' : 'passagens';
    const idaVoltaText = is_ida_volta ? 'Ida e Volta' : 'Somente Ida';
    
    // CABEÇALHO
    const header = `33.90.33 - Aquisição de ${quantidade_passagens} ${passagemPlural} (${tipo_transporte}) para o trecho ${origem} / ${destino} (${idaVoltaText}), para atender a OM ${organizacao}, durante ${dias_operacao} ${diaPlural} de ${faseFormatada}.`;

    return `${header}

OM Favorecida: ${organizacao} (UG: ${formatCodug(ug)})
OM Contratante (Detentora do Recurso): ${om_detentora} (UG: ${formatCodug(ug_detentora)})

Detalhes do Trecho:
- Origem: ${origem}
- Destino: ${destino}
- Tipo de Transporte: ${tipo_transporte}
- Modalidade: ${idaVoltaText}
- Valor Unitário: ${formatCurrency(valor_unitario)}

Cálculo:
Fórmula: Quantidade de Passagens x Valor Unitário do Trecho.
- ${formatNumber(quantidade_passagens)} x ${formatCurrency(valor_unitario)} = ${formatCurrency(valor_total)}.

Alocação:
- ND 33.90.33 (Passagens): ${formatCurrency(valor_nd_33)}

Valor Total: ${formatCurrency(valor_total)}.`;
};