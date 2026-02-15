import { formatCurrency } from "./formatUtils";
import { ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";

export interface ServicoTerceiroRegistro {
    id: string;
    p_trab_id: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    categoria: string;
    detalhes_planejamento: any;
    valor_total: number;
    valor_nd_30: number;
    valor_nd_39: number;
    detalhamento_customizado?: string | null;
    created_at?: string;
    updated_at?: string;
}

export const calculateServicoTotals = (items: any[], trips: number = 1) => {
    let totalND30 = 0;
    let totalND39 = 0;

    items.forEach(item => {
        const qty = item.quantidade || 0;
        const period = item.periodo || 0;
        const subtotal = qty * period * item.valor_unitario * trips;

        // Lógica de ND baseada na categoria e subcategoria
        // Para transporte coletivo, meios de transporte e serviços adicionais (como Km) vão para ND 33
        // No banco, usamos valor_nd_39 para representar ND 33/39 dependendo do contexto
        if (item.codigo_catser?.startsWith('3.3.90.30') || item.codigo_catmat?.startsWith('3.3.90.30')) {
            totalND30 += subtotal;
        } else {
            totalND39 += subtotal;
        }
    });

    return {
        totalND30,
        totalND39,
        totalGeral: totalND30 + totalND39
    };
};

export const generateServicoMemory = (reg: ServicoTerceiroRegistro): string => {
    const details = reg.detalhes_planejamento;
    if (!details || !details.itens_selecionados) return "Sem detalhes de planejamento.";

    const lines: string[] = [];
    const isTransport = reg.categoria === 'transporte-coletivo';
    const trips = isTransport ? (Number(details.numero_viagens) || 1) : 1;

    lines.push(`CATEGORIA: ${reg.categoria.toUpperCase()}`);
    
    if (isTransport) {
        lines.push(`ITINERÁRIO: ${details.itinerario || 'N/A'}`);
        lines.push(`DISTÂNCIA ITINERÁRIO: ${details.distancia_itinerario || 0} Km`);
        lines.push(`DISTÂNCIA PERCORRIDA/DIA: ${details.distancia_percorrida_dia || 0} Km`);
        lines.push(`NÚMERO DE VIAGENS: ${trips}`);
    }

    lines.push("");
    lines.push("CÁLCULO:");

    details.itens_selecionados.forEach((item: any) => {
        const qty = item.quantidade || 0;
        const period = item.periodo || 0;
        const unit = item.unidade_medida || 'un';
        const valUnit = formatCurrency(item.valor_unitario);
        const totalItem = formatCurrency(qty * period * item.valor_unitario * trips);
        
        // Adiciona informação de limite diário se existir
        const limitInfo = (isTransport && item.sub_categoria === 'meio-transporte' && item.has_daily_limit && item.daily_limit_km)
            ? ` (até ${item.daily_limit_km} Km)`
            : "";

        if (isTransport) {
            lines.push(`- ${item.descricao_reduzida || item.descricao_item}: ${qty} un x ${period} ${unit} x ${trips} viagens x ${valUnit}/${unit}${limitInfo} = ${totalItem}`);
        } else if (reg.categoria === 'fretamento-aereo') {
            lines.push(`- ${item.descricao_reduzida || item.descricao_item}: ${qty} HV x ${valUnit}/HV = ${totalItem}`);
        } else {
            lines.push(`- ${item.descricao_reduzida || item.descricao_item}: ${qty} un x ${period} ${unit} x ${valUnit}/${unit} = ${totalItem}`);
        }
    });

    lines.push("");
    lines.push(`VALOR TOTAL: ${formatCurrency(reg.valor_total)}`);

    return lines.join("\n");
};