import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug } from "./formatUtils";
import { TrechoSelection } from "@/components/PassagemTrechoSelectorDialog";

// Tipos de dados
export type PassagemRegistro = Tables<'passagem_registros'>;
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
    const { 
        organizacao, ug, om_detentora, ug_detentora, dias_operacao, efetivo, fase_atividade,
        origem, destino, tipo_transporte, is_ida_volta, valor_unitario, quantidade_passagens,
        valor_total,
    } = data;

    const total = Number(valor_total || 0);
    const unitario = Number(valor_unitario || 0);
    const qtd = quantidade_passagens;
    
    const diasText = dias_operacao === 1 ? "dia" : "dias";
    const efetivoText = efetivo === 1 ? "militar" : "militares";
    const idaVoltaText = is_ida_volta ? 'Ida/Volta' : 'Ida';
    
    let memoria = "";
    
    // Cabeçalho simplificado para o item individual (usado no staging)
    memoria += `33.90.33 - Aquisição de Passagem para ${efetivo} ${efetivoText} do(a) ${organizacao} (${formatCodug(ug)}), durante ${dias_operacao} ${diasText} de ${fase_atividade}.\n\n`;
    
    memoria += `Cálculo:\n`;
    memoria += `- ${origem} -> ${destino}: ${formatCurrency(unitario)} (${tipo_transporte} - ${idaVoltaText}).\n\n`;
    
    memoria += `Fórmula: Qtd Psg x Valor Unitário da Psg.\n`;
    memoria += `- ${qtd} Psg ${origem}-${destino} (${tipo_transporte}-${idaVoltaText}) x ${formatCurrency(unitario)} = ${formatCurrency(total)}.\n\n`;
    
    memoria += `Total: ${formatCurrency(total)}.\n`;
    
    return memoria;
};


/**
 * Gera a memória de cálculo CONSOLIDADA para um grupo de registros de passagem (usado na Seção 5).
 * @param group O objeto ConsolidatedPassagemRecord contendo todos os registros do lote.
 * @returns String formatada da memória de cálculo consolidada.
 */
export const generateConsolidatedPassagemMemoriaCalculo = (group: ConsolidatedPassagemRecord): string => {
    const { organizacao, ug, dias_operacao, efetivo, fase_atividade, records, totalGeral } = group;

    const diasText = dias_operacao === 1 ? "dia" : "dias";
    const efetivoText = efetivo === 1 ? "militar" : "militares";
    
    let memoria = "";
    
    // 1. Cabeçalho Consolidado
    memoria += `33.90.33 - Aquisição de Passagem para ${efetivo} ${efetivoText} do(a) ${organizacao} (${formatCodug(ug)}), durante ${dias_operacao} ${diasText} de ${fase_atividade}.\n\n`;
    
    // 2. Detalhe dos Trechos (Cálculo)
    memoria += `Cálculo:\n`;
    records.forEach(r => {
        const unitario = Number(r.valor_unitario || 0);
        const idaVoltaText = r.is_ida_volta ? 'Ida/Volta' : 'Ida';
        memoria += `- ${r.origem}-${r.destino}: ${formatCurrency(unitario)} (${r.tipo_transporte} - ${idaVoltaText}).\n`;
    });
    memoria += "\n";
    
    // 3. Aplicação da Fórmula
    memoria += `Fórmula: Qtd Psg x Valor Unitário da Psg.\n`;
    records.forEach(r => {
        const total = Number(r.valor_total || 0);
        const unitario = Number(r.valor_unitario || 0);
        const qtd = r.quantidade_passagens;
        const idaVoltaText = r.is_ida_volta ? 'Ida/Volta' : 'Ida';
        
        memoria += `- ${qtd} Psg ${r.origem}-${r.destino} (${r.tipo_transporte}-${idaVoltaText}) x ${formatCurrency(unitario)} = ${formatCurrency(total)}.\n`;
    });
    memoria += "\n";
    
    // 4. Total
    memoria += `Total: ${formatCurrency(totalGeral)}.\n`;
    
    return memoria;
};