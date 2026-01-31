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
    } = registro;

    const tipoViagem = is_ida_volta ? 'IDA E VOLTA' : 'SOMENTE IDA';
    const faseTexto = formatFasesParaTexto(fase_atividade);
    
    let memoria = `Passagem para ${efetivo} militares, no trecho ${origem} / ${destino} (${tipoViagem}), para a fase de ${faseTexto}.\n`;
    memoria += `Tipo de Transporte: ${tipo_transporte}.\n`;
    memoria += `Quantidade de passagens: ${formatNumber(quantidade_passagens)} un.\n`;
    memoria += `Valor Unitário: ${formatCurrency(valor_unitario)}.\n`;
    memoria += `Valor Total (ND 33.90.33): ${formatCurrency(valor_nd_33)}.\n`;
    
    if (registro.detalhamento) {
        memoria += `Detalhamento: ${registro.detalhamento}\n`;
    }
    
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

    let memoria = `SOLICITAÇÃO CONSOLIDADA DE PASSAGENS (ND 33.90.33)\n`;
    memoria += `OM Favorecida: ${organizacao} (UG: ${formatCodug(ug)})\n`;
    memoria += `Total de Militares Envolvidos: ${formatNumber(total_efetivo)}\n`;
    memoria += `Total de Passagens Solicitadas: ${formatNumber(total_quantidade)} un.\n`;
    memoria += `Valor Total Solicitado: ${formatCurrency(total_valor)}\n\n`;
    
    memoria += "DETALHAMENTO DOS TRECHOS:\n";
    
    // Agrupar por trecho (origem/destino/tipo_transporte/ida_volta)
    const trechosAgrupados: Record<string, { 
        origem: string, 
        destino: string, 
        tipo_transporte: string, 
        is_ida_volta: boolean, 
        valor_unitario: number, 
        quantidade_total: number,
        fases: Set<string>,
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
                fases: new Set<string>(),
            };
        }
        
        trechosAgrupados[key].quantidade_total += r.quantidade_passagens;
        if (r.fase_atividade) {
            r.fase_atividade.split(';').forEach(f => trechosAgrupados[key].fases.add(f.trim()));
        }
    });
    
    Object.values(trechosAgrupados).forEach((trecho, index) => {
        const tipoViagem = trecho.is_ida_volta ? 'I/V' : 'IDA';
        const fasesTexto = Array.from(trecho.fases).filter(f => f).join(', ') || 'operação';
        
        memoria += `\n${index + 1}. Trecho: ${trecho.origem} / ${trecho.destino} (${tipoViagem})\n`;
        memoria += `   - Transporte: ${trecho.tipo_transporte}\n`;
        memoria += `   - Quantidade: ${formatNumber(trecho.quantidade_total)} un. (R$ ${formatNumber(trecho.valor_unitario)} un.)\n`;
        memoria += `   - Fases: ${fasesTexto}\n`;
    });

    return memoria;
};