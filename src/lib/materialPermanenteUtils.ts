import { formatCurrency, formatNumber } from "./formatUtils";

/**
 * Gera a memória de cálculo automática para um item de Material Permanente.
 */
export const generateMaterialPermanenteMemoria = (registro: any, item: any) => {
  if (!registro || !item) return "Dados insuficientes para gerar a memória.";

  const qtd = Number(item.quantidade || 0);
  const valorUnit = Number(item.valor_unitario || 0);
  const totalItem = qtd * valorUnit;

  let memoria = `DETALHAMENTO DE MATERIAL PERMANENTE\n`;
  memoria += `====================================\n\n`;
  
  memoria += `ITEM: ${item.descricao_item || item.descricao_reduzida || "Não especificado"}\n`;
  if (item.codigo_item || item.code) {
    memoria += `CÓDIGO (CATMAT): ${item.codigo_item || item.code}\n`;
  }
  
  memoria += `ORGANIZAÇÃO: ${registro.organizacao || "Não informada"}\n`;
  memoria += `QUANTIDADE: ${formatNumber(qtd, 0)} unidade(s)\n`;
  memoria += `VALOR UNITÁRIO: ${formatCurrency(valorUnit)}\n`;
  memoria += `VALOR TOTAL DO ITEM: ${formatCurrency(totalItem)}\n`;
  
  if (registro.fase_atividade) {
    memoria += `\nFASE/ATIVIDADE: ${registro.fase_atividade}\n`;
  }
  
  if (item.justificativa || item.observacao) {
    memoria += `\nJUSTIFICATIVA/OBSERVAÇÃO:\n${item.justificativa || item.observacao}\n`;
  }

  return memoria;
};