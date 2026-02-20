import { formatCurrency, formatPregao } from "./formatUtils";

export const calculateMaterialPermanenteTotals = (items: any[]) => {
    const totalGeral = items.reduce((acc, item) => acc + ((item.quantidade || 0) * (item.valor_unitario || 0)), 0);
    return { totalGeral };
};

/**
 * Extrai os dados de justificativa de forma robusta, tratando arrays ou objetos aninhados.
 */
const extractJustificativaData = (item: any) => {
    let data = item?.justificativa || {};

    // Se for um array (como visto no JSON do usuário), pega o primeiro elemento
    if (Array.isArray(data) && data.length > 0) {
        data = data[0];
    }

    // Se o objeto resultante tiver uma propriedade 'justificativa' interna (aninhamento detectado)
    // e não tiver os campos diretos, mergulha mais um nível
    if (data && typeof data === 'object' && data.justificativa && !data.grupo) {
        data = data.justificativa;
    }

    return data;
};

/**
 * Gera a memória de cálculo para Material Permanente.
 */
export const generateMaterialPermanenteMemoriaCalculo = (registro: any, item: any) => {
    if (!item) return "";

    // Extração robusta da justificativa
    const justData = extractJustificativaData(item);
    const { grupo, proposito, destinacao, local, finalidade, motivo } = justData;
    
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