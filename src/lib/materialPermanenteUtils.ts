import { formatCurrency, formatCodug, formatPregao } from "./formatUtils";

/**
 * Gera a memória de cálculo detalhada para um item de Material Permanente.
 * Utiliza os campos específicos do objeto de justificativa.
 */
export const generateMaterialPermanenteMemoriaCalculo = (registro: any, options?: { itemEspecifico?: any }) => {
    const item = options?.itemEspecifico;
    if (!item) return "";

    // Dados do item e subitem
    const subitemNome = item.subitem_nome || registro.nome_subitem || "Material Permanente";
    const nomeItem = item.descricao_reduzida || item.descricao_item;
    const valorUnitario = item.valor_unitario || 0;
    const quantidade = item.quantidade || 1;
    const valorTotal = valorUnitario * quantidade;
    const pregao = item.numero_pregao || "N/A";
    const uasg = item.uasg || "N/A";

    // Extração da justificativa estruturada
    const j = item.justificativa || {};
    const proposito = j.proposito || "as necessidades operacionais";
    const destinacao = j.destinacao || "";
    const local = j.local || "na organização militar";
    const motivo = j.motivo || "pela necessidade de recompletamento";
    const finalidade = j.finalidade || "garantir a continuidade das ações";

    // Montagem da frase principal (Seção 5)
    let memoria = `44.90.52 - Aquisição de ${subitemNome} para atender ${proposito} ${destinacao}, ${local}, ${motivo}, a fim de ${finalidade}.\n\n`;
    
    memoria += `Cálculo:\n`;
    memoria += `- ${nomeItem}: ${formatCurrency(valorUnitario)}/ unid.\n\n`;
    
    memoria += `Fórmula: Qtd do item x Valor do item.\n`;
    memoria += `- ${quantidade} ${nomeItem} x ${formatCurrency(valorUnitario)}/unid = ${formatCurrency(valorTotal)}.\n\n`;
    
    memoria += `Total: ${formatCurrency(valorTotal)}.\n`;
    memoria += `(Pregão ${formatPregao(pregao)} - UASG ${formatCodug(uasg)}).`;

    return memoria;
};

/**
 * Calcula os totais de uma lista de registros de Material Permanente.
 */
export const calculateMaterialPermanenteTotals = (registros: any[]) => {
  return registros.reduce((acc, reg) => {
    const valor = Number(reg.valor_total || 0);
    const nd52 = Number(reg.valor_nd_52 || 0);
    return {
      totalGeral: acc.totalGeral + valor,
      totalND52: acc.totalND52 + nd52
    };
  }, { totalGeral: 0, totalND52: 0 });
};