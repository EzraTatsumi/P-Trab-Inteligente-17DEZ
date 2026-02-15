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
    group_name?: string | null;
    group_purpose?: string | null;
}

export const calculateServicoTotals = (items: any[], trips: number = 1) => {
    let totalND30 = 0;
    let totalND39 = 0;

    items.forEach(item => {
        const qty = item.quantidade || 0;
        const period = item.periodo || 0;
        const val = item.valor_unitario || 0;
        
        const multiplier = (item.sub_categoria === 'servico-adicional') ? 1 : trips;
        const total = qty * period * val * multiplier;

        if (item.natureza_despesa === '33') totalND30 += total;
        else totalND39 += total;
    });

    return {
        totalND30,
        totalND39,
        totalGeral: totalND30 + totalND39
    };
};

export const generateServicoMemoriaCalculo = (registro: ServicoTerceiroRegistro, context: any) => {
    const details = registro.detalhes_planejamento;
    const items = details?.itens_selecionados || [];
    const categoria = registro.categoria;
    
    // 1. Determinar ND (33 ou 39)
    const hasND33 = items.some((i: any) => i.natureza_despesa === '33');
    const ndCode = hasND33 ? '33.90.33' : '33.90.39';
    
    // 2. Determinar Ação (Contratação ou Locação)
    const isLocacao = details?.tipo_contrato_outros === 'locacao';
    const actionLabel = isLocacao ? 'Locação' : 'Contratação';
    
    // 3. Determinar Nome do Serviço
    const catLabel = categoria === 'outros' ? (details.nome_servico_outros || 'Serviços de Terceiros') : formatCategoryLabel(categoria);
    
    // 4. Determinar Destinatário (Efetivo ou apenas OM)
    const hasEfetivo = details?.has_efetivo !== false && registro.efetivo > 0;
    const targetLabel = hasEfetivo 
        ? `para atender ${registro.efetivo} militares do/da ${registro.organizacao}`
        : `para atender o/a ${registro.organizacao}`;

    // Montagem do Cabeçalho
    let memoria = `${ndCode} - ${actionLabel} de ${catLabel} ${targetLabel}, durante ${registro.dias_operacao} dias de Planejamento.\n\n`;

    // Detalhes específicos de outras categorias (mantidos)
    if (categoria === 'fretamento-aereo') {
        memoria += `Detalhes da Aeronave:\n`;
        memoria += `- Tipo: ${details.tipo_anv || 'N/A'}\n`;
        memoria += `- Capacidade: ${details.capacidade || 'N/A'}\n`;
        memoria += `- Velocidade de Cruzeiro: ${details.velocidade_cruzeiro || 0} Km/h\n`;
        memoria += `- Distância a percorrer: ${details.distancia_percorrer || 0} Km\n\n`;
    }

    if (categoria === 'servico-satelital') {
        memoria += `Propósito: ${details.proposito || 'N/A'}\n`;
        memoria += `Equipamento: ${details.tipo_equipamento || 'N/A'}\n\n`;
    }

    if (categoria === 'transporte-coletivo') {
        memoria += `Logística de Transporte:\n`;
        memoria += `- Itinerário: ${details.itinerario || 'N/A'}\n`;
        memoria += `- Distância Itinerário: ${details.distancia_itinerario || 0} Km\n`;
        memoria += `- Distância percorrida/dia: ${details.distancia_percorrida_dia || 0} Km\n`;
        memoria += `- Número de Viagens: ${details.numero_viagens || 1}\n\n`;
    }

    // Seção de Cálculo
    memoria += `Cálculo:\n\n`;
    items.forEach((item: any) => {
        memoria += `${item.descricao_reduzida || item.descricao_item}: ${formatCurrency(item.valor_unitario)}/${item.unidade_medida || 'un'}.\n`;
    });

    memoria += `Fórmula: Nr Item x Valor Unitário.\n\n`;
    
    const trips = categoria === 'transporte-coletivo' ? (Number(details.numero_viagens) || 1) : 1;

    items.forEach((item: any) => {
        const qty = item.quantidade || 0;
        const period = (item.periodo !== undefined) ? item.periodo : 1;
        const unit = item.unidade_medida || 'un';
        const val = item.valor_unitario || 0;
        
        const periodFormatted = Number.isInteger(period) ? period.toString() : period.toString().replace('.', ',');
        
        const multiplier = (categoria === 'transporte-coletivo' && item.sub_categoria === 'servico-adicional') ? 1 : trips;
        const total = qty * period * val * multiplier;

        if (categoria === 'transporte-coletivo' && item.sub_categoria === 'meio-transporte') {
            memoria += `${qty} ${item.descricao_reduzida || item.descricao_item} (${periodFormatted} ${unit} x ${trips} viagens) x ${formatCurrency(val)}/${unit} = ${formatCurrency(total)}.\n`;
        } else if (categoria === 'fretamento-aereo') {
            memoria += `${qty} ${item.descricao_reduzida || item.descricao_item} x ${formatCurrency(val)}/${unit} = ${formatCurrency(total)}.\n`;
        } else {
            // Formato padrão para Outros e demais categorias
            memoria += `${qty} ${item.descricao_reduzida || item.descricao_item} (${periodFormatted} ${unit}) x ${formatCurrency(val)}/${unit} = ${formatCurrency(total)}.\n`;
        }
    });

    memoria += `Total: ${formatCurrency(registro.valor_total)}. `;
    
    if (items.length > 0) {
        const firstItem = items[0];
        memoria += `(Pregão ${formatPregao(firstItem.numero_pregao)} - UASG ${formatCodug(firstItem.uasg)})`;
    }

    return memoria;
};

const formatCategoryLabel = (cat: string) => {
    if (cat === 'fretamento-aereo') return 'Fretamento Aéreo';
    if (cat === 'servico-satelital') return 'Serviço Satelital';
    if (cat === 'transporte-coletivo') return 'Transporte Coletivo';
    if (cat === 'locacao-veiculos') return 'Locação de Veículos';
    if (cat === 'locacao-estruturas') return 'Locação de Estruturas';
    if (cat === 'servico-grafico') return 'Serviço Gráfico';
    return 'Serviços de Terceiros';
};