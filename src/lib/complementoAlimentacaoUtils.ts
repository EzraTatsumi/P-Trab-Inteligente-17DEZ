import { Json } from "@/integrations/supabase/types";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCodug, formatPregao, formatCurrency } from "@/lib/formatUtils";

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
    
    publico: string;
    valor_etapa_qs: number;
    pregao_qs: string | null;
    om_qs: string | null;
    ug_qs: string | null;
    valor_etapa_qr: number;
    pregao_qr: string | null;
    om_qr: string | null;
    ug_qr: string | null;

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

export const MEMORIA_SEPARATOR = "\n\n--- DIVISOR_MEMORIA ---\n\n";

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
    const diasText = registro.dias_operacao === 1 ? "dia" : "dias";
    const publicoText = registro.publico || "militares";

    if (registro.categoria_complemento === 'genero') {
        const totalQS = (registro.efetivo || 0) * (registro.dias_operacao || 0) * (registro.valor_etapa_qs || 0);
        const totalQR = (registro.efetivo || 0) * (registro.dias_operacao || 0) * (registro.valor_etapa_qr || 0);
        
        const valQS = formatCurrency(registro.valor_etapa_qs || 0);
        const valQR = formatCurrency(registro.valor_etapa_qr || 0);
        const tQS = formatCurrency(totalQS);
        const tQR = formatCurrency(totalQR);

        const blockQS = `33.90.30 - Aquisição de Gêneros Alimentícios para atender ${registro.efetivo} ${publicoText}, durante ${registro.dias_operacao} ${diasText} de ${context.fase_atividade}.\n\n` +
                        `Cálculo:\n` +
                        `- Valor do Complemento: ${valQS}/dia.\n\n` +
                        `Fórmula: Efetivo a ser alimentado x valor da etapa x Nr de dias.\n` +
                        `- ${registro.efetivo} ${publicoText} x ${valQS}/dia x ${registro.dias_operacao} ${diasText} = ${tQS}.\n\n` +
                        `Total: ${tQS}.\n` +
                        `(Pregão ${formatPregao(registro.pregao_qs || '')} - UASG ${formatCodug(registro.ug_qs || '')})`;

        const blockQR = `33.90.30 - Aquisição de Gêneros Alimentícios para atender ${registro.efetivo} ${publicoText}, durante ${registro.dias_operacao} ${diasText} de ${context.fase_atividade}.\n\n` +
                        `Cálculo:\n` +
                        `- Valor do Complemento: ${valQR}/dia.\n\n` +
                        `Fórmula: Efetivo a ser alimentado x valor da etapa x Nr de dias.\n` +
                        `- ${registro.efetivo} ${publicoText} x ${valQR}/dia x ${registro.dias_operacao} ${diasText} = ${tQR}.\n\n` +
                        `Total: ${tQR}.\n` +
                        `(Pregão ${formatPregao(registro.pregao_qr || '')} - UASG ${formatCodug(registro.ug_qr || '')})`;

        return `${blockQS}${MEMORIA_SEPARATOR}${blockQR}`;
    }

    if (registro.categoria_complemento === 'agua') {
        const consumo = registro.agua_consumo_dia || 0;
        const volEnvase = registro.agua_volume_envase || 1;
        const valUnid = registro.agua_valor_unitario || 0;
        const totalVal = Number(registro.valor_total || 0);
        
        const valUnidFmt = formatCurrency(valUnid);
        const totalValFmt = formatCurrency(totalVal);

        return `33.90.30 - Aquisição de Água Mineral para atender ${registro.efetivo} ${publicoText}, durante ${registro.dias_operacao} ${diasText} de ${context.fase_atividade}.\n\n` +
               `Cálculo:\n` +
               `- Consumo considerado: ${consumo.toLocaleString('pt-BR')}L/dia/pessoa.\n` +
               `- Tipo de Envase: ${registro.agua_tipo_envase}.\n` +
               `- Volume do Envase: ${volEnvase.toLocaleString('pt-BR')} L.\n` +
               `- Valor da unidade: ${valUnidFmt}.\n\n` +
               `Fórmula: [(Efetivo x Consumo) / Volume Envase] x Nr de dias x valor da unidade.\n` +
               `- [(${registro.efetivo} ${publicoText} x ${consumo.toLocaleString('pt-BR')} L água/dia) / ${volEnvase.toLocaleString('pt-BR')} L/unid] x ${registro.dias_operacao} ${diasText} x ${valUnidFmt}/unid = ${totalValFmt}.\n\n` +
               `Total: ${totalValFmt}.\n` +
               `(Pregão ${formatPregao(registro.agua_pregao || '')} - UASG ${formatCodug(registro.ug_detentora || '')})`;
    }

    if (registro.categoria_complemento === 'lanche') {
        const itens = (registro.itens_aquisicao || []) as any[];
        
        // Calcula o valor do kit (soma dos valores unitários dos itens)
        const kitValue = itens.reduce((sum, item) => sum + (Number(item.valor_unitario || 0) * Number(item.quantidade || 1)), 0);
        const kitValueFmt = formatCurrency(kitValue);
        
        const listaComposicao = itens.map(item => 
            `    - ${item.descricao || item.descricao_item}: ${formatCurrency(item.valor_unitario)}.`
        ).join('\n');

        const totalVal = Number(registro.valor_total || 0);
        const totalValFmt = formatCurrency(totalVal);
        const diasText = registro.dias_operacao === 1 ? "dia" : "dias";
        const publicoText = registro.publico || "militares";

        return `33.90.30 - Aquisição de gêneros para confecção de catanho/lanche para atender ${registro.efetivo} ${publicoText}, durante ${registro.dias_operacao} ${diasText} de ${context.fase_atividade}.\n\n` +
               `Cálculo:\n` +
               `- Valor do catanho/lanche: ${kitValueFmt}/dia.\n` +
               `- Composição do catanho/lanche:\n${listaComposicao}\n\n` +
               `Fórmula: Efetivo x Valor do catanho/lanche x Nr de dias.\n` +
               `- ${registro.efetivo} ${publicoText} x ${kitValueFmt}/unid x ${registro.dias_operacao} ${diasText} = ${totalValFmt}.\n\n` +
               `Total: ${totalValFmt}.\n` +
               `(Pregão ${formatPregao(registro.pregao_qs || '')} - UASG ${formatCodug(registro.ug_detentora || '')})`;
    }

    return "";
};