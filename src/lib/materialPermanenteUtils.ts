import { formatCurrency, formatPregao } from "./formatUtils";

export const calculateMaterialPermanenteTotals = (items: any[]) => {
    const totalGeral = items.reduce((acc, item) => acc + ((item.quantidade || 0) * (item.valor_unitario || 0)), 0);
    return { totalGeral };
};

/**
 * Gera a memória de cálculo para Material Permanente.
 */
export const generateMaterialPermanenteMemoriaCalculo = (registro: any, item: any) => {
    if (!item) return "";

    // Extração da justificativa com fallbacks seguros para evitar placeholders
    const j = item.justificativa || {};
    const grupo = j.grupo || item.descricao_reduzida || item.descricao_item || "[Item]";
    const proposito = j.proposito || "atender às necessidades da operação";
    const destinacao = j.destinacao || "";
    const local = j.local || "no local da atividade";
    const finalidade = j.finalidade || "cumprir a missão delegada";
    const motivo = j.motivo || "da necessidade técnica/operacional identificada";
    
    const diasStr = `${registro.dias_operacao || 1} ${registro.dias_operacao === 1 ? 'dia' : 'dias'}`;
    const fase = registro.fase_atividade || 'Operação';
    
    const justificativa = `Aquisição de ${grupo} para atender ${proposito} ${destinacao}, ${local}, a fim de ${finalidade}, durante ${diasStr} de ${fase}. Justifica-se essa aquisição pela ${motivo}.`;

    const valorUnitario = Number(item.valor_unitario || 0);
    const quantidade = Number(item.quantidade || 0);
    const valorTotal = valorUnitario * quantidade;
    const nomeItem = item.descricao_reduzida || item.descricao_item || "Item";
    const pregao = formatPregao(item.numero_pregao);
    const uasg = item.codigo_uasg || registro.ug_detentora || registro.ug || "N/A";

    return `44.90.52 - ${justificativa}

Cálculo: 
- ${nomeItem}: ${formatCurrency(valorUnitario)}/ unid.

Fórmula: Qtd do item x Valor do item.
- ${quantidade} ${nomeItem} x ${formatCurrency(valorUnitario)}/unid = ${formatCurrency(valorTotal)}.

Total: ${formatCurrency(valorTotal)}.
(Pregão ${pregao} - UASG ${uasg})`;
};