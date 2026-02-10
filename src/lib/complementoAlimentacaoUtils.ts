import { Json } from "@/integrations/supabase/types";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";

export interface ComplementoAlimentacaoRegistro {
    id: string;
    p_trab_id: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    group_name: string;
    group_purpose: string | null;
    categoria_complemento: 'genero' | 'agua' | 'lanche'; // Nova variável
    itens_aquisicao: ItemAquisicao[];
    valor_total: number;
    valor_nd_30: number;
    valor_nd_39: number;
    detalhamento_customizado: string | null;
    created_at: string;
    updated_at: string;
}

export interface ConsolidatedComplementoRecord {
    groupKey: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    records: ComplementoAlimentacaoRegistro[];
    totalGeral: number;
    totalND30: number;
    totalND39: number;
}

export interface AcquisitionGroup {
    tempId: string;
    groupName: string;
    groupPurpose: string | null;
    items: ItemAquisicao[];
    totalValue: number;
    totalND30: number;
    totalND39: number;
}

export const calculateGroupTotals = (items: ItemAquisicao[]) => {
    return items.reduce((acc, item) => {
        const total = Number(item.valor_total || 0);
        acc.totalValue += total;
        if (item.nd === '33.90.30') acc.totalND30 += total;
        if (item.nd === '33.90.39') acc.totalND39 += total;
        return acc;
    }, { totalValue: 0, totalND30: 0, totalND39: 0 });
};

export const generateComplementoMemoriaCalculo = (
    registro: Partial<ComplementoAlimentacaoRegistro>,
    context: { organizacao: string; efetivo: number; dias_operacao: number; fase_atividade: string }
): string => {
    const itens = (registro.itens_aquisicao || []) as ItemAquisicao[];
    const listaItens = itens.map(item => 
        `- ${item.quantidade} un. de ${item.descricao_reduzida || item.descricao_item} (Cód: ${item.codigo_catmat})`
    ).join('\n');

    const categoriaMap = {
        genero: 'Gênero Alimentício',
        agua: 'Água Mineral',
        lanche: 'Lanche/Catanho'
    };

    const categoriaLabel = categoriaMap[registro.categoria_complemento as keyof typeof categoriaMap] || 'Complemento';

    return `Solicitação de ${categoriaLabel} para a OM ${context.organizacao}.\n` +
           `Contexto: Efetivo de ${context.efetivo} militares por ${context.dias_operacao} dias na fase ${context.fase_atividade}.\n` +
           `Itens selecionados:\n${listaItens}\n` +
           `Valor Total: R$ ${Number(registro.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};