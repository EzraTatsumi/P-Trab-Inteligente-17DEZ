import { formatCurrency, formatPregao, formatCodug } from "./formatUtils";

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
    group_name?: string;
    group_purpose?: string | null;
}

export const calculateServicoTotals = (items: any[], trips: number = 1) => {
    let totalND30 = 0;
    let totalND39 = 0;

    items.forEach(item => {
        const qty = item.quantidade || 0;
        const period = item.periodo || 0;
        const val = item.valor_unitario || 0;
        
        // Se for serviço adicional no transporte coletivo, não multiplica por viagens
        const multiplier = (item.sub_categoria === 'servico-adicional') ? 1 : trips;
        const total = qty * period * val * multiplier;

        if (item.natureza_despesa === '339030') totalND30 += total;
        else totalND39 += total;
    });

    return {
        totalND30,
        totalND39,
        totalGeral: totalND30 + totalND39
    };
};

export const generateServicoMemoriaCalculo = (reg: ServicoTerceiroRegistro): string => {
    if (reg.detalhamento_customizado) return reg.detalhamento_customizado;

    const details = reg.detalhes_planejamento;
    const items = details?.itens_selecionados || [];
    const trips = Number(details?.numero_viagens) || 1;
    
    let memoria = "";

    if (reg.categoria === 'locacao-estruturas') {
        memoria = `33.90.39 - Locação de Estruturas, para o/a ${reg.organizacao}, durante ${reg.dias_operacao} dia/dias de ${reg.fase_atividade}.\n\n`;
        memoria += `Cálculo:\n`;
        
        items.forEach((item: any) => {
            const unit = item.unidade_medida || 'UN';
            const period = item.periodo || reg.dias_operacao;
            const itemTotal = (item.quantidade || 0) * period * (item.valor_unitario || 0);
            
            memoria += `- ${item.descricao_reduzida || item.descricao_item}: ${formatCurrency(item.valor_unitario)}/${unit}.\n`;
            memoria += `Fórmula: Nr Estrutura x Valor Unitário x Período.\n`;
            memoria += `- ${item.quantidade} ${item.descricao_reduzida || item.descricao_item} x ${formatCurrency(item.valor_unitario)}/${unit} x ${period} dia/dias = ${formatCurrency(itemTotal)}.\n\n`;
        });

        memoria += `Total: ${formatCurrency(Number(reg.valor_total))}.\n`;
        if (items.length > 0) {
            memoria += `(Pregão ${formatPregao(items[0].numero_pregao)} - UASG ${formatCodug(items[0].uasg)}).`;
        }
        return memoria;
    }

    // Fallback para outras categorias (mantendo lógica simplificada)
    memoria = `${reg.categoria === 'fretamento-aereo' || reg.categoria === 'transporte-coletivo' ? '33.90.33' : '33.90.39'} - ${reg.categoria.toUpperCase()}, para o/a ${reg.organizacao}.\n\n`;
    
    items.forEach((item: any) => {
        const qty = item.quantidade || 0;
        const period = item.periodo || 1;
        const multiplier = (reg.categoria === 'transporte-coletivo' && item.sub_categoria === 'servico-adicional') ? 1 : trips;
        const total = qty * period * item.valor_unitario * multiplier;
        
        memoria += `- ${qty} un x ${item.descricao_reduzida || item.descricao_item} x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(total)}\n`;
    });

    memoria += `\nTotal Geral: ${formatCurrency(Number(reg.valor_total))}`;
    return memoria;
};