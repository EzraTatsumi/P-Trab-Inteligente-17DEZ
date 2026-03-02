import { formatCurrency, formatCodug } from "./formatUtils";

/**
 * Gera o texto formatado para a memória de cálculo de um item de material permanente.
 */
export const generateMaterialPermanenteMemoriaCalculo = (registro: any, item: any) => {
  if (!registro || !item) return "";

  const om = registro.organizacao || "OM não informada";
  const ug = registro.ug || "000000";
  const uasg = item.uasg || registro.ug || "000000";
  const pregao = item.numero_pregao || "000/0000";
  const subitem = item.subitem_nr || item.nr_subitem || "00";
  const itemNome = item.descricao_reduzida || item.descricao_item || "Material Permanente";
  const qtd = item.quantidade || 1;
  const valorUnit = item.valor_unitario || 0;
  const valorTotal = qtd * valorUnit;

  // Normalização da justificativa (lidando com possíveis aninhamentos)
  let justData = item.justificativa || {};
  if (Array.isArray(justData) && justData.length > 0) justData = justData[0];
  if (justData && justData.justificativa && !justData.grupo) justData = justData.justificativa;

  const { grupo, proposito, destinacao, local, finalidade, motivo } = justData;

  const linhas = [
    `OM: ${om} (UG: ${formatCodug(ug)})`,
    `AQUISIÇÃO DE ${itemNome.toUpperCase()}`,
    `UASG: ${formatCodug(uasg)} | PREGÃO: ${pregao} | SUBITEM: ${subitem}`,
    `QUANTIDADE: ${qtd} | VALOR UNITÁRIO: ${formatCurrency(valorUnit)} | VALOR TOTAL: ${formatCurrency(valorTotal)}`,
    ``,
    `JUSTIFICATIVA:`,
    `Aquisição de ${grupo || '[Grupo]'} para atender ${proposito || '[Propósito]'} ${destinacao || '[Destinação]'}, ${local || '[Local]'}, a fim de ${finalidade || '[Finalidade]'}, durante ${registro.dias_operacao} dias de ${registro.fase_atividade}. Justifica-se essa aquisição ${motivo || '[Motivo]'}.`
  ];

  return linhas.join('\n');
};

/**
 * Calcula os totais financeiros para uma lista de itens.
 */
export const calculateMaterialPermanenteTotals = (items: any[]) => {
  const totalGeral = items.reduce((acc, item) => acc + (Number(item.valor_unitario || 0) * Number(item.quantidade || 1)), 0);
  return { totalGeral };
};