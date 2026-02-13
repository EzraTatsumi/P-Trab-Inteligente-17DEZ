import { ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import { Tables } from "@/integrations/supabase/types";

export type ServicoTerceiroRegistro = Tables<'servicos_terceiros_registros'>;

export const calculateServicoTotals = (items: ItemAquisicaoServico[]) => {
    let totalND30 = 0;
    let totalND39 = 0;
    let totalGeral = 0;

    items.forEach(item => {
        const value = Number(item.valor_total || 0);
        totalGeral += value;
        if (item.nd === '30') totalND30 += value;
        else if (item.nd === '39') totalND39 += value;
    });

    return { totalND30, totalND39, totalGeral };
};

export const generateServicoMemoriaCalculo = (registro: any, context: any) => {
    const itensTexto = (registro.detalhes_planejamento?.itens_selecionados || [])
        .map((item: any) => `- ${item.quantidade}x ${item.descricao_reduzida || item.descricao_item} (${item.codigo_catmat}): ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_total)}`)
        .join('\n');

    return `MEMÓRIA DE CÁLCULO - SERVIÇOS DE TERCEIROS (${registro.categoria.toUpperCase()})
--------------------------------------------------
OM FAVORECIDA: ${context.organizacao}
FASE: ${context.fase_atividade}
PERÍODO: ${context.dias_operacao} dias
EFETIVO: ${context.efetivo} militares

ITENS PLANEJADOS:
${itensTexto || 'Nenhum item selecionado.'}

TOTAL GERAL: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(registro.valor_total)}`;
};