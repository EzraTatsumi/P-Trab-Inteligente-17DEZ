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
    
    // Metadados para Gênero Alimentício (armazenados no JSONB ou campos auxiliares)
    publico: string;
    valor_etapa_qs: number;
    pregao_qs: string | null;
    om_qs: string | null;
    ug_qs: string | null;
    valor_etapa_qr: number;
    pregao_qr: string | null;
    om_qr: string | null;
    ug_qr: string | null;
    
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
    records: any[]; // Registros do banco
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
    // Campos específicos de Gênero
    isGenero?: boolean;
    generoData?: {
        publico: string;
        valor_etapa_qs: number;
        pregao_qs: string;
        om_qs: string;
        ug_qs: string;
        valor_etapa_qr: number;
        pregao_qr: string;
        om_qr: string;
        ug_qr: string;
    };
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

// Função para gerar a memória de Gênero (QS ou QR)
export const generateGeneroText = (
    tipo: 'QS' | 'QR',
    data: any,
    context: any
): string => {
    const valorEtapa = tipo === 'QS' ? data.valor_etapa_qs : data.valor_etapa_qr;
    const pregao = tipo === 'QS' ? data.pregao_qs : data.pregao_qr;
    const uasg = tipo === 'QS' ? data.ug_qs : data.ug_qr;
    const total = (context.efetivo || 0) * (context.dias_operacao || 0) * (valorEtapa || 0);
    
    const formattedTotal = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formattedEtapa = valorEtapa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    return `33.90.30 - Aquisição de Gêneros Alimentícios (${tipo}) para atender ${context.efetivo} ${data.publico}, durante ${context.dias_operacao} ${context.dias_operacao === 1 ? 'dia' : 'dias'} de ${context.fase_atividade}.

Cálculo: 
- Valor do Complemento: ${formattedEtapa}/dia.

Fórmula: (Efetivo a ser alimentado x valor da etapa) x Nr de dias.
- ${context.efetivo} ${data.publico} x ${formattedEtapa}/dia) x ${context.dias_operacao} ${context.dias_operacao === 1 ? 'dia' : 'dias'} = ${formattedTotal}.

Total: ${formattedTotal}.
(Pregão ${pregao || 'N/A'} - UASG ${uasg || 'N/A'}).`;
};

export const generateComplementoMemoriaCalculo = (
    registro: any,
    context: { organizacao: string; efetivo: number; dias_operacao: number; fase_atividade: string }
): string => {
    // Se for Gênero, a memória é composta por QS e QR (será tratada no componente visual para separar em dois blocos)
    if (registro.categoria_complemento === 'genero' || registro.isGenero) {
        const data = registro.generoData || registro;
        const qs = generateGeneroText('QS', data, context);
        const qr = generateGeneroText('QR', data, context);
        return `${qs}\n\n---\n\n${qr}`;
    }

    // Lógica para Água e Lanche (baseada em itens)
    const itens = (registro.itens_aquisicao || []) as ItemAquisicao[];
    const listaItens = itens.map(item => 
        `- ${item.quantidade} un. de ${item.descricao_reduzida || item.descricao_item} (Cód: ${item.codigo_catmat})`
    ).join('\n');

    const categoriaMap = {
        agua: 'Água Mineral',
        lanche: 'Lanche/Catanho'
    };

    const categoriaLabel = categoriaMap[registro.categoria_complemento as keyof typeof categoriaMap] || 'Complemento';

    return `33.90.30 - Aquisição de ${categoriaLabel} para atender ${context.efetivo} militares, durante ${context.dias_operacao} ${context.dias_operacao === 1 ? 'dia' : 'dias'} de ${context.fase_atividade}.

Itens selecionados:
${listaItens}

Valor Total: ${Number(registro.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
};