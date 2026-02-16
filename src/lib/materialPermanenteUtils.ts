import { formatCurrency, formatNumber, formatCodug, formatPregao } from "./formatUtils";

/**
 * Gera a memória de cálculo para registros de Material Permanente.
 * @param registro O registro de material permanente vindo do banco.
 * @param context Contexto opcional com dados da OM e operação.
 * @returns Uma string formatada com o detalhamento dos itens.
 */
export const generateMaterialPermanenteMemoriaCalculo = (registro: any, context?: any): string => {
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
        return registro.detalhamento_customizado;
    }

    const items = registro.detalhes_planejamento?.items || [];
    if (items.length === 0) return "Nenhum item detalhado.";

    const org = registro.organizacao || context?.organizacao || 'OM não especificada';
    let memoria = `Aquisição de Material Permanente para ${org}:\n\n`;

    items.forEach((item: any, index: number) => {
        const totalItem = (item.valor_unitario || 0) * (item.quantidade || 0);
        memoria += `${index + 1}. ${item.descricao_reduzida || item.descricao_item}\n`;
        memoria += `   - CATMAT: ${item.codigo_catmat || 'N/A'}\n`;
        memoria += `   - Pregão: ${formatPregao(item.numero_pregao)} | UASG: ${formatCodug(item.uasg)}\n`;
        memoria += `   - Qtd: ${formatNumber(item.quantidade, 0)} | Unit: ${formatCurrency(item.valor_unitario)} | Total: ${formatCurrency(totalItem)}\n\n`;
    });

    memoria += `Valor Total do Registro: ${formatCurrency(registro.valor_total || 0)}`;
    
    return memoria;
};

/**
 * Calcula os totais agregados para uma lista de registros de Material Permanente.
 * @param registros Lista de registros vindos do banco.
 * @returns Objeto com totais de valor geral e ND 52.
 */
export const calculateMaterialPermanenteTotals = (registros: any[]) => {
    return registros.reduce((acc, r) => {
        acc.totalGeral += Number(r.valor_total || 0);
        acc.totalND52 += Number(r.valor_nd_52 || 0);
        return acc;
    }, { totalGeral: 0, totalND52: 0 });
};