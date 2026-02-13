import { ItemAquisicaoServico, DetalhesPlanejamentoServico } from "@/types/diretrizesServicosTerceiros";
import { formatCurrency, formatCodug, formatPregao } from "./formatUtils";
import { Tables } from "@/integrations/supabase/types";

export type ServicoTerceiroRegistro = Tables<'servicos_terceiros_registros'>;

/**
 * Calcula os totais do lote de serviços, separando por ND.
 */
export const calculateServicoTotals = (items: ItemAquisicaoServico[]) => {
    return items.reduce((acc, item) => {
        const totalItem = (item.quantidade || 0) * item.valor_unitario;
        if (item.nd === '30') acc.totalND30 += totalItem;
        else acc.totalND39 += totalItem;
        acc.totalGeral += totalItem;
        return acc;
    }, { totalGeral: 0, totalND30: 0, totalND39: 0 });
};

/**
 * Gera a memória de cálculo descritiva baseada na categoria e itens.
 */
export const generateServicoMemoriaCalculo = (
    registro: Partial<ServicoTerceiroRegistro>,
    context: { organizacao: string, efetivo: number, dias_operacao: number, fase_atividade: string | null }
): string => {
    const { categoria, detalhes_planejamento } = registro;
    const planejamento = detalhes_planejamento as unknown as DetalhesPlanejamentoServico;
    const items = planejamento?.itens_selecionados || [];
    
    if (items.length === 0) return "Nenhum item selecionado.";

    const categoriaFormatada = (categoria || "").replace('-', ' ').toUpperCase();
    const diasText = context.dias_operacao === 1 ? "dia" : "dias";
    
    let texto = `MEMÓRIA DE CÁLCULO - ${categoriaFormatada}\n`;
    texto += `--------------------------------------------------\n`;
    texto += `OM FAVORECIDA: ${context.organizacao}\n`;
    texto += `FINALIDADE: Atender às necessidades de ${categoriaFormatada.toLowerCase()} durante a fase de ${context.fase_atividade || 'Operação'}, com efetivo de ${context.efetivo} militares, pelo período de ${context.dias_operacao} ${diasText}.\n\n`;
    
    texto += `DETALHAMENTO DOS ITENS:\n`;
    
    items.forEach((item, index) => {
        const totalItem = (item.quantidade || 0) * item.valor_unitario;
        texto += `${index + 1}. ${item.descricao_item}\n`;
        texto += `   - Quantidade: ${item.quantidade} ${item.unidade_medida}\n`;
        texto += `   - Valor Unitário: ${formatCurrency(item.valor_unitario)}\n`;
        texto += `   - Subtotal: ${formatCurrency(totalItem)}\n`;
        texto += `   - Amparo: Pregão ${formatPregao(item.numero_pregao)} (UASG: ${formatCodug(item.uasg)})\n\n`;
    });

    const totals = calculateServicoTotals(items);
    texto += `--------------------------------------------------\n`;
    texto += `VALOR TOTAL DO PLANEJAMENTO: ${formatCurrency(totals.totalGeral)}\n`;
    if (totals.totalND30 > 0) texto += `Dotação ND 33.90.30: ${formatCurrency(totals.totalND30)}\n`;
    if (totals.totalND39 > 0) texto += `Dotação ND 33.90.39: ${formatCurrency(totals.totalND39)}\n`;

    return texto;
};