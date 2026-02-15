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
        
        // Se for serviço adicional no transporte coletivo, não multiplica por viagens
        const multiplier = (item.sub_categoria === 'servico-adicional') ? 1 : trips;
        const total = qty * period * val * multiplier;

        // Verifica se a ND selecionada é 33 (que mapeamos para valor_nd_30 no banco por legado de estrutura) ou 39
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
    
    // Usa o nome customizado se for a categoria 'outros'
    const catLabel = categoria === 'outros' ? (details.nome_servico_outros || 'Serviços de Terceiros') : formatCategoryLabel(categoria);
    
    // Determina a ND predominante para o cabeçalho
    const hasND33 = items.some((i: any) => i.natureza_despesa === '33');
    const hasND39 = items.some((i: any) => i.natureza_despesa === '39' || !i.natureza_despesa);
    const ndHeader = (hasND33 && hasND39) ? '33.90.33 / 33.90.39' : (hasND33 ? '33.90.33' : '33.90.39');
    
    // LÓGICA ESPECÍFICA PARA CATEGORIA "OUTROS"
    if (categoria === 'outros') {
        const tipoContrato = details.tipo_contrato_outros === 'locacao' ? 'Locação' : 'Contratação';
        const beneficiary = details.has_efetivo
            ? `para atender ${registro.efetivo} militares do/da ${registro.organizacao}`
            : `para atender o/a ${registro.organizacao}`;

        let memoria = `${ndHeader} - ${tipoContrato} de ${catLabel} ${beneficiary}, durante ${registro.dias_operacao} dias de Planejamento.\n\n`;
        
        memoria += `Cálculo:\n`;
        items.forEach((item: any) => {
            memoria += `- ${item.descricao_reduzida || item.descricao_item}: ${formatCurrency(item.valor_unitario)}/${item.unidade_medida || 'un'}.\n`;
        });
        
        memoria += `\nFórmula: Nr Item x Valor Unitário.\n`;

        items.forEach((item: any) => {
            const qty = item.quantidade || 0;
            const period = (item.periodo !== undefined) ? item.periodo : 1;
            const unit = item.unidade_medida || 'un';
            const val = item.valor_unitario || 0;
            const total = qty * period * val;
            const periodFormatted = Number.isInteger(period) ? period.toString() : period.toString().replace('.', ',');

            memoria += `- ${qty} ${item.descricao_reduzida || item.descricao_item} (${periodFormatted} ${unit}) x ${formatCurrency(val)}/${unit} = ${formatCurrency(total)}.\n`;
        });

        memoria += `\nTotal: ${formatCurrency(registro.valor_total)}.\n`;
        if (items.length > 0) {
            const firstItem = items[0];
            memoria += `(Pregão ${formatPregao(firstItem.numero_pregao)} - UASG ${formatCodug(firstItem.uasg)})`;
        }
        return memoria;
    }

    // LÓGICA PARA DEMAIS CATEGORIAS (MANTIDA ORIGINAL)
    let memoria = `${ndHeader} - Contratação de ${catLabel}, para a ${registro.organizacao}, durante ${registro.dias_operacao} dias de Planejamento.\n\n`;

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

    memoria += `Cálculo:\n`;
    items.forEach((item: any) => {
        memoria += `- ${item.descricao_reduzida || item.descricao_item}: ${formatCurrency(item.valor_unitario)}/${item.unidade_medida || 'un'}.\n`;
    });

    memoria += `\nFórmula: Nr Item x Valor Unitário.\n`;
    
    const trips = categoria === 'transporte-coletivo' ? (Number(details.numero_viagens) || 1) : 1;

    items.forEach((item: any) => {
        const qty = item.quantidade || 0;
        const period = (item.periodo !== undefined) ? item.periodo : 1;
        const unit = item.unidade_medida || 'un';
        const val = item.valor_unitario || 0;
        const ndItem = item.natureza_despesa === '33' ? 'ND 33' : 'ND 39';
        
        const periodFormatted = Number.isInteger(period) ? period.toString() : period.toString().replace('.', ',');
        
        const multiplier = (categoria === 'transporte-coletivo' && item.sub_categoria === 'servico-adicional') ? 1 : trips;
        const total = qty * period * val * multiplier;

        if (categoria === 'transporte-coletivo' && item.sub_categoria === 'meio-transporte') {
            memoria += `- ${qty} ${item.descricao_reduzida || item.descricao_item} (${periodFormatted} ${unit} x ${trips} viagens) x ${formatCurrency(val)}/${unit} = ${formatCurrency(total)} (${ndItem}).\n`;
        } else if (categoria === 'fretamento-aereo') {
            memoria += `- ${qty} ${item.descricao_reduzida || item.descricao_item} x ${formatCurrency(val)}/${unit} = ${formatCurrency(total)} (${ndItem}).\n`;
        } else {
            memoria += `- ${qty} ${item.descricao_reduzida || item.descricao_item} (${periodFormatted} ${unit}) x ${formatCurrency(val)}/${unit} = ${formatCurrency(total)} (${ndItem}).\n`;
        }
    });

    memoria += `\nTotal: ${formatCurrency(registro.valor_total)}.\n`;
    
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