import { PassagemRegistro } from "@/pages/PTrabReportManager";
import { formatCurrency, formatNumber, formatCodug } from "./formatUtils";
import { formatFasesParaTexto } from "@/pages/PTrabReportManager";

// Tipo para o grupo consolidado de passagens (usado no ConsolidatedPassagemMemoria)
export interface ConsolidatedPassagemRecord {
    diretriz_id: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    total_valor: number;
    total_nd_33: number;
    total_quantidade: number;
    total_efetivo: number;
    records: PassagemRegistro[];
}

/**
 * Gera a memória de cálculo para um único registro de passagem.
 */
export const generatePassagemMemoriaCalculo = (registro: PassagemRegistro): string => {
    const { 
        origem, 
        destino, 
        tipo_transporte, 
        is_ida_volta, 
        valor_unitario, 
        quantidade_passagens, 
        efetivo, 
        valor_nd_33,
        fase_atividade,
        organizacao,
        ug,
    } = registro;

    const tipoViagem = is_ida_volta ? 'Ida e Volta' : 'Ida';
    const faseTexto = formatFasesParaTexto(fase_atividade);
    const omFavorecida = `${organizacao} (${formatCodug(ug)})`;
    
    let memoria = `33.90.33 - Aquisição de Passagem para ${efetivo} militar${efetivo > 1 ? 'es' : ''} da ${omFavorecida}, durante ${registro.dias_operacao} dia${registro.dias_operacao > 1 ? 's' : ''} de ${faseTexto}.\n\n`;
    
    // Detalhe do Trecho
    memoria += `Cálculo:\n`;
    memoria += `- ${origem}-${destino}: ${formatCurrency(valor_unitario)} (${tipo_transporte} - ${tipoViagem}).\n\n`;
    
    // Fórmula
    memoria += `Fórmula: Qtd Psg x Valor Unitário da Psg.\n`;
    memoria += `- ${formatNumber(quantidade_passagens)} Psg ${origem}-${destino} (${tipo_transporte}-${tipoViagem}) x ${formatCurrency(valor_unitario)} = ${formatCurrency(valor_nd_33)}.\n\n`;
    
    // Total
    memoria += `Total: ${formatCurrency(valor_nd_33)}.`;
    
    return memoria;
};

/**
 * Gera a memória de cálculo consolidada para um grupo de registros de passagem.
 * Esta função é usada no componente ConsolidatedPassagemMemoria.
 */
export const generateConsolidatedPassagemMemoriaCalculo = (group: ConsolidatedPassagemRecord): string => {
    const { 
        organizacao, 
        ug, 
        total_valor, 
        total_quantidade, 
        total_efetivo, 
        records 
    } = group;

    const faseTexto = formatFasesParaTexto(records[0]?.fase_atividade);
    const diasOperacao = records[0]?.dias_operacao || 0;
    const omFavorecida = `${organizacao} (UG: ${formatCodug(ug)})`;

    let memoria = `33.90.33 - Aquisição de Passagens para ${total_efetivo} militar${total_efetivo > 1 ? 'es' : ''} da ${omFavorecida}, durante ${diasOperacao} dia${diasOperacao > 1 ? 's' : ''} de ${faseTexto}.\n\n`;
    
    memoria += `Cálculo Consolidado:\n`;
    
    // Agrupar por trecho (origem/destino/tipo_transporte/ida_volta)
    const trechosAgrupados: Record<string, { 
        origem: string, 
        destino: string, 
        tipo_transporte: string, 
        is_ida_volta: boolean, 
        valor_unitario: number, 
        quantidade_total: number,
        valor_total_trecho: number,
    }> = {};
    
    records.forEach(r => {
        const key = `${r.origem}|${r.destino}|${r.tipo_transporte}|${r.is_ida_volta}|${r.valor_unitario}`;
        
        if (!trechosAgrupados[key]) {
            trechosAgrupados[key] = {
                origem: r.origem,
                destino: r.destino,
                tipo_transporte: r.tipo_transporte,
                is_ida_volta: r.is_ida_volta,
                valor_unitario: r.valor_unitario,
                quantidade_total: 0,
                valor_total_trecho: 0,
            };
        }
        
        trechosAgrupados[key].quantidade_total += r.quantidade_passagens;
        trechosAgrupados[key].valor_total_trecho += r.valor_total;
    });
    
    Object.values(trechosAgrupados).forEach((trecho) => {
        const tipoViagem = trecho.is_ida_volta ? 'I/V' : 'Ida';
        memoria += `- ${trecho.origem}-${trecho.destino}: ${formatCurrency(trecho.valor_unitario)} (${trecho.tipo_transporte} - ${tipoViagem}).\n`;
    });
    
    memoria += `\nFórmula: Soma (Qtd Psg x Valor Unitário da Psg).\n`;
    
    Object.values(trechosAgrupados).forEach((trecho) => {
        const tipoViagem = trecho.is_ida_volta ? 'I/V' : 'Ida';
        memoria += `- ${formatNumber(trecho.quantidade_total)} Psg ${trecho.origem}-${trecho.destino} (${trecho.tipo_transporte}-${tipoViagem}) x ${formatCurrency(trecho.valor_unitario)} = ${formatCurrency(trecho.valor_total_trecho)}.\n`;
    });
    
    memoria += `\nTotal: ${formatCurrency(total_valor)}.`;

    return memoria;
};