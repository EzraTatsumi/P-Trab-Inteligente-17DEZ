import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug } from "./formatUtils";
import { TrechoSelection } from "@/components/PassagemTrechoSelectorDialog";

// Tipos de dados
// Usamos o tipo Tables do Supabase e o estendemos/redefinimos para usar camelCase onde necessário
export interface PassagemRegistro extends Tables<'passagem_registros'> {
    // Sobrescrevemos as propriedades que queremos em camelCase para consistência no frontend
    diasOperacao: number; // Mapeado de dias_operacao
    faseAtividade: string | null; // Mapeado de fase_atividade
    isIdaVolta: boolean; // Mapeado de is_ida_volta
    quantidadePassagens: number; // Mapeado de quantidade_passagens
    valorUnitario: number; // Mapeado de valor_unitario
    valorNd33: number; // Mapeado de valor_nd_33
    omDetentora: string; // Mapeado de om_detentora
    ugDetentora: string; // Mapeado de ug_detentora
    
    // Mantemos as propriedades originais do DB para compatibilidade com o tipo Tables
    dias_operacao: number;
    fase_atividade: string | null;
    is_ida_volta: boolean;
    quantidade_passagens: number;
    valor_unitario: number;
    valor_nd_33: number;
    om_detentora: string;
    ug_detentora: string;
}

export type PassagemForm = TablesInsert<'passagem_registros'>;

// Tipo para o registro consolidado (usado na Seção 5)
export interface ConsolidatedPassagemRecord {
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    records: PassagemRegistro[];
    totalGeral: number;
    totalND33: number;
}

/**
 * Calcula os totais de um único registro de passagem (um trecho).
 * @param data Dados do formulário.
 * @returns Objeto com valor_total e valor_nd_33.
 */
export const calculatePassagemTotals = (data: PassagemForm) => {
    const valorUnitario = Number(data.valor_unitario || 0);
    const quantidadePassagens = Number(data.quantidade_passagens || 0);
    
    const valorTotal = valorUnitario * quantidadePassagens;
    
    return {
        valor_total: valorTotal,
        valor_nd_33: valorTotal, // Passagens são ND 33.90.33
    };
};

/**
 * Gera a memória de cálculo para um ÚNICO registro de passagem (usado no Staging/Revisão).
 * O formato é simplificado para focar no cálculo do trecho.
 * @param data O registro de passagem calculado.
 * @returns String formatada da memória de cálculo.
 */
export const generatePassagemMemoriaCalculo = (data: PassagemRegistro): string => {
    // Usando as propriedades em camelCase
    const { 
        organizacao, diasOperacao, efetivo, faseAtividade,
        origem, destino, tipo_transporte, isIdaVolta, valorUnitario, quantidadePassagens,
        valor_total,
    } = data;

    const total = Number(valor_total || 0);
    const unitario = Number(valorUnitario || 0);
    const qtd = quantidadePassagens;
    
    const diasText = diasOperacao === 1 ? "dia" : "dias";
    const efetivoText = efetivo === 1 ? "militar" : "militares";
    const idaVoltaText = isIdaVolta ? 'Ida/Volta' : 'Ida';
    
    // Lógica de concordância de gênero (do/da)
    const omNameLower = organizacao.toLowerCase();
    const concordancia = omNameLower.includes('ª') ? 'da' : 'do';
    
    let memoria = "";
    
    // Cabeçalho simplificado para o item individual (usado no staging)
    memoria += `33.90.33 - Aquisição de Passagem para ${efetivo} ${efetivoText} ${concordancia} ${organizacao}, durante ${diasOperacao} ${diasText} de ${faseAtividade}.\n\n`;
    
    memoria += `Cálculo:\n`;
    memoria += `- ${origem} -> ${destino}: ${formatCurrency(unitario)} (${tipo_transporte} - ${idaVoltaText}).\n\n`;
    
    memoria += `Fórmula: Qtd Psg x Valor Unitário da Psg.\n`;
    memoria += `- ${qtd} Psg ${origem}-${destino} (${tipo_transporte}-${idaVoltaText}) x ${formatCurrency(unitario)} = ${formatCurrency(total)}.\n\n`;
    
    memoria += `Total: ${formatCurrency(total)}.\n`;
    
    return memoria;
};


/**
 * Gera a memória de cálculo CONSOLIDADA para um grupo de registros de passagem (usado na Seção 5).
 * NOTA: A linha do Pregão/UASG é adicionada dinamicamente no componente de renderização (ConsolidatedPassagemMemoria)
 * após a busca dos detalhes da diretriz.
 * @param group O objeto ConsolidatedPassagemRecord contendo todos os registros do lote.
 * @returns String formatada da memória de cálculo consolidada.
 */
export const generateConsolidatedPassagemMemoriaCalculo = (group: ConsolidatedPassagemRecord): string => {
    const { organizacao, dias_operacao, efetivo, fase_atividade, records, totalGeral } = group;

    const diasText = dias_operacao === 1 ? "dia" : "dias";
    const efetivoText = efetivo === 1 ? "militar" : "militares";
    
    // Lógica de concordância de gênero (do/da)
    const omNameLower = organizacao.toLowerCase();
    const concordancia = omNameLower.includes('ª') ? 'da' : 'do';
    
    let memoria = "";
    
    // 1. Cabeçalho Consolidado
    memoria += `33.90.33 - Aquisição de Passagem para ${efetivo} ${efetivoText} ${concordancia} ${organizacao}, durante ${dias_operacao} ${diasText} de ${fase_atividade}.\n\n`;
    
    // 2. Detalhe dos Trechos (Cálculo)
    memoria += `Cálculo:\n`;
    records.forEach(r => {
        // Usando as propriedades em camelCase
        const unitario = Number(r.valorUnitario || 0);
        const idaVoltaText = r.isIdaVolta ? 'Ida/Volta' : 'Ida';
        memoria += `- ${r.origem} -> ${r.destino}: ${formatCurrency(unitario)} (${r.tipo_transporte} - ${idaVoltaText}).\n`;
    });
    memoria += "\n";
    
    // 3. Aplicação da Fórmula
    memoria += `Fórmula: Qtd Psg x Valor Unitário da Psg.\n`;
    records.forEach(r => {
        // Usando as propriedades em camelCase
        const total = Number(r.valor_total || 0);
        const unitario = Number(r.valorUnitario || 0);
        const qtd = r.quantidadePassagens;
        const idaVoltaText = r.isIdaVolta ? 'Ida/Volta' : 'Ida';
        
        memoria += `- ${qtd} Psg ${r.origem}-${r.destino} (${r.tipo_transporte}-${idaVoltaText}) x ${formatCurrency(unitario)} = ${formatCurrency(total)}.\n`;
    });
    memoria += "\n";
    
    // 4. Total
    memoria += `Total: ${formatCurrency(totalGeral)}.\n`;
    
    return memoria;
};