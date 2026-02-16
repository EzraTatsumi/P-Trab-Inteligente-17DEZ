import { formatCurrency, formatCodug, formatPregao } from "./formatUtils";

/**
 * Gera a memória de cálculo detalhada para um item de Material Permanente.
 */
export const generateMaterialPermanenteMemoriaCalculo = (registro: any, options?: { itemEspecifico?: any }) => {
    const item = options?.itemEspecifico;
    if (!item) return "";

    const descricaoSubitem = registro.descricao_subitem || registro.nome_subitem || "Material Permanente";
    const organizacao = registro.organizacao;
    const local = registro.local_om || "Quartel-General";
    const justificativa = registro.detalhamento_customizado || "";
    
    const nomeItem = item.descricao_reduzida || item.descricao_item;
    const valorUnitario = item.valor_unitario || 0;
    const quantidade = item.quantidade || 1;
    const valorTotal = valorUnitario * quantidade;
    const pregao = item.numero_pregao || "N/A";
    const uasg = item.uasg || "N/A";

    let memoria = `44.90.52 - Aquisição de ${descricaoSubitem} para atender as necessidades do ${organizacao}, no ${local}, a fim de garantir as capacidades operacionais e administrativas. ${justificativa}\n\n`;
    
    memoria += `Cálculo:\n`;
    memoria += `- ${nomeItem}: ${formatCurrency(valorUnitario)}/ unid.\n\n`;
    
    memoria += `Fórmula: Qtd do item x Valor do item.\n`;
    memoria += `- ${quantidade} ${nomeItem} x ${formatCurrency(valorUnitario)}/unid = ${formatCurrency(valorTotal)}.\n\n`;
    
    memoria += `Total: ${formatCurrency(valorTotal)}.\n`;
    memoria += `(Pregão ${formatPregao(pregao)} - UASG ${formatCodug(uasg)}).`;

    return memoria;
};