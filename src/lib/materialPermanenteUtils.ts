import { formatCurrency, formatPregao } from "./formatUtils";

export const calculateMaterialPermanenteTotals = (items: any[]) => {
    const totalGeral = items.reduce((acc, item) => acc + ((item.quantidade || 0) * (item.valor_unitario || 0)), 0);
    return { totalGeral };
};

/**
 * Gera a memória de cálculo para Material Permanente.
 * Renomeada para generateMaterialPermanenteMemoriaCalculo para satisfazer as importações do projeto.
 */
export const generateMaterialPermanenteMemoriaCalculo = (registro: any, item: any) => {
    if (!item) return "";

    // Extração da justificativa
    const { grupo, proposito, destinacao, local, finalidade, motivo } = item.justificativa || {};
    const diasStr = `${registro.dias_operacao} ${registro.dias_operacao === 1 ? 'dia' : 'dias'}`;
    const fase = registro.fase_atividade || '[Fase]';
    
    const justificativa = `Aquisição de ${grupo || '[Grupo]'} para atender ${proposito || '[Propósito]'} ${destinacao || '[Destinação]'}, ${local || '[Local]'}, a fim de ${finalidade || '[Finalidade]'}, durante ${diasStr} de ${fase}. Justifica-se essa aquisição ${motivo || '[Motivo]'}.`;

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