import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency } from "./formatUtils";

/**
 * Calcula os totais para um lote de materiais permanentes.
 */
export const calculateMaterialPermanenteTotals = (items: ItemAquisicao[]) => {
    const totalGeral = items.reduce((acc, item) => acc + ((item.quantidade || 0) * item.valor_unitario), 0);
    return { totalGeral };
};

/**
 * Gera o texto padrão da memória de cálculo para um item de material permanente.
 */
export const generateMaterialPermanenteMemoria = (registro: any, item: ItemAquisicao) => {
    const { organizacao, dias_operacao, fase_atividade } = registro;
    const qtd = item.quantidade || 0;
    const valorUnit = item.valor_unitario || 0;
    const total = qtd * valorUnit;
    
    const justificativa = item.justificativa as any;
    const motivoText = justificativa?.motivo ? ` Justifica-se essa aquisição ${justificativa.motivo}.` : "";

    return `Para atender às necessidades da ${organizacao}, durante o período de ${dias_operacao} ${dias_operacao === 1 ? 'dia' : 'dias'} da fase de ${fase_atividade || '[Fase]'}, faz-se necessária a aquisição de ${qtd} unidade(s) de ${item.descricao_reduzida || item.descricao_item}, ao valor unitário de ${formatCurrency(valorUnit)}, totalizando ${formatCurrency(total)}. A aquisição visa atender ${justificativa?.proposito || '[Propósito]'} ${justificativa?.destinacao || '[Destinação]'}, no local ${justificativa?.local || '[Local]'}, com a finalidade de ${justificativa?.finalidade || '[Finalidade]'}.${motivoText}`;
};