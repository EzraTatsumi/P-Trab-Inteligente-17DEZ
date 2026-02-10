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
    categoria_complemento: 'genero' | 'agua' | 'lanche';
    
    // Novos campos para Gênero Alimentício (estilo Classe I)
    publico: string;
    valor_etapa_qs: number;
    pregao_qs: string | null;
    om_qs: string | null;
    ug_qs: string | null;
    valor_etapa_qr: number;
    pregao_qr: string | null;
    om_qr: string | null;
    ug_qr: string | null;

    // Novos campos para Água Mineral
    agua_consumo_dia: number | null;
    agua_tipo_envase: string | null;
    agua_volume_envase: number | null;
    agua_valor_unitario: number | null;
    agua_pregao: string | null;
    
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
    if (registro.categoria_complemento === 'genero') {
        const totalQS = (registro.efetivo || 0) * (registro.dias_operacao || 0) * (registro.valor_etapa_qs || 0);
        const totalQR = (registro.efetivo || 0) * (registro.dias_operacao || 0) * (registro.valor_etapa_qr || 0);
        
        return `Solicitação de Gênero Alimentício para a OM ${context.organizacao}.\n` +
               `Público: ${registro.publico || 'Não informado'}\n` +
               `Contexto: ${registro.efetivo} militares por ${registro.dias_operacao} dias na fase ${context.fase_atividade}.\n` +
               `Cálculo QS: ${registro.efetivo} x ${registro.dias_operacao} x R$ ${registro.valor_etapa_qs?.toFixed(2)} = R$ ${totalQS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
               `Cálculo QR: ${registro.efetivo} x ${registro.dias_operacao} x R$ ${registro.valor_etapa_qr?.toFixed(2)} = R$ ${totalQR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
               `Valor Total: R$ ${Number(registro.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }

    if (registro.categoria_complemento === 'agua') {
        const totalLitros = (registro.efetivo || 0) * (registro.agua_consumo_dia || 0) * (registro.dias_operacao || 0);
        const totalGarrafas = Math.ceil(totalLitros / (registro.agua_volume_envase || 1));
        
        return `Solicitação de Água Mineral para a OM ${context.organizacao}.\n` +
               `Contexto: ${registro.efetivo} militares por ${registro.dias_operacao} dias na fase ${context.fase_atividade}.\n` +
               `Consumo estimado: ${registro.agua_consumo_dia}L/dia por pessoa.\n` +
               `Total de Litros: ${totalLitros.toLocaleString('pt-BR')}L.\n` +
               `Envase: ${registro.agua_tipo_envase} de ${registro.agua_volume_envase}L.\n` +
               `Cálculo: ${totalGarrafas} garrafas x R$ ${registro.agua_valor_unitario?.toFixed(2)} = R$ ${Number(registro.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }

    const itens = (registro.itens_aquisicao || []) as ItemAquisicao[];
    const listaItens = itens.map(item => 
        `- ${item.quantidade} un. de ${item.descricao_reduzida || item.descricao_item} (Cód: ${item.codigo_catmat})`
    ).join('\n');

    return `Solicitação de Lanche/Catanho para a OM ${context.organizacao}.\n` +
           `Contexto: Efetivo de ${context.efetivo} militares por ${context.dias_operacao} dias na fase ${context.fase_atividade}.\n` +
           `Itens selecionados:\n${listaItens}\n` +
           `Valor Total: R$ ${Number(registro.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};