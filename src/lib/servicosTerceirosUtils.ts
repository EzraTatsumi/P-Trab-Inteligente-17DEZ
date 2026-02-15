import { formatCurrency, formatPregao, formatCodug, formatNumber } from "./formatUtils";

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

/**
 * Define a preposição correta (do/da) baseada no nome da OM.
 */
const getOmPreposition = (name: string) => {
    const lower = name.toLowerCase();
    const feminineKeywords = ['cia', 'companhia', 'base', 'escola', 'academia', 'policlínica', 'prefeitura', 'delegacia', 'seção', 'brigada', 'divisão', 'região', 'inspetoria', 'diretoria', 'secretaria', 'superintendência', 'agência', 'fundação', 'universidade', 'faculdade', 'biblioteca', 'gráfica'];
    
    if (feminineKeywords.some(k => lower.includes(k))) return 'da';
    return 'do';
};

/**
 * Define o artigo correto (o/a) baseado no nome da OM.
 */
const getOmArticle = (name: string) => {
    const lower = name.toLowerCase();
    const feminineKeywords = ['cia', 'companhia', 'base', 'escola', 'academia', 'policlínica', 'prefeitura', 'delegacia', 'seção', 'brigada', 'divisão', 'região', 'inspetoria', 'diretoria', 'secretaria', 'superintendência', 'agência', 'fundação', 'universidade', 'faculdade', 'biblioteca', 'gráfica'];
    
    if (feminineKeywords.some(k => lower.includes(k))) return 'a';
    return 'o';
};

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
    
    // LÓGICA ESPECÍFICA PARA CATEGORIA "OUTROS"
    if (categoria === 'outros') {
        const hasND33 = items.some((i: any) => i.natureza_despesa === '33');
        const hasND39 = items.some((i: any) => i.natureza_despesa === '39' || !i.natureza_despesa);
        const ndHeader = (hasND33 && hasND39) ? '33.90.33 / 33.90.39' : (hasND33 ? '33.90.33' : '33.90.39');
        
        const catLabel = details.nome_servico_outros || 'Serviços de Terceiros';
        const tipoContrato = details.tipo_contrato_outros === 'locacao' ? 'Locação' : 'Contratação';
        const pluralMilitar = registro.efetivo === 1 ? 'militar' : 'militares';
        const pluralDia = registro.dias_operacao === 1 ? 'dia' : 'dias';
        
        const prep = getOmPreposition(registro.organizacao);
        const art = getOmArticle(registro.organizacao);

        const beneficiary = details.has_efetivo
            ? `para atender ${registro.efetivo} ${pluralMilitar} ${prep} ${registro.organizacao}`
            : `para atender ${art} ${registro.organizacao}`;

        let memoria = `${ndHeader} - ${tipoContrato} de ${catLabel} ${beneficiary}, durante ${registro.dias_operacao} ${pluralDia} de Planejamento.\n\n`;
        
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

    // LÓGICA PARA DEMAIS CATEGORIAS
    // Locação de veículos agora é 33.90.33 conforme solicitado
    const nd = (categoria === 'fretamento-aereo' || categoria === 'transporte-coletivo' || categoria === 'locacao-veiculos') ? '33.90.33' : '33.90.39';
    
    let catLabel = formatCategoryLabel(categoria);
    // Inclui o nome do grupo no cabeçalho da Locação de Veículos
    if (categoria === 'locacao-veiculos') {
        const groupName = registro.group_name || details?.group_name || 'Grupo de Veículos';
        catLabel = `${catLabel} (${groupName})`;
    }

    let header = `${nd} - Contratação de ${catLabel}`;
    
    // Ajuste no cabeçalho do Serviço Satelital
    if (categoria === 'servico-satelital') {
        header = `${nd} - Contratação de Serviço Satelital de ${details.tipo_equipamento || 'N/A'}, visando ${details.proposito || 'N/A'}`;
    }
    
    let memoria = `${header}, para a ${registro.organizacao}, durante ${registro.dias_operacao} dias de Planejamento.\n\n`;

    if (categoria === 'fretamento-aereo') {
        memoria += `Detalhes da Aeronave:\n`;
        memoria += `- Tipo: ${details.tipo_anv || 'N/A'}\n`;
        memoria += `- Capacidade: ${details.capacidade || 'N/A'}\n`;
        memoria += `- Velocidade de Cruzeiro: ${details.velocidade_cruzeiro || 0} Km/h\n`;
        // Distância a percorrer com ponto de milhar
        memoria += `- Distância a percorrer: ${formatNumber(details.distancia_percorrer || 0, 0)} Km\n\n`;
    }

    memoria += `Cálculo:\n`;
    
    // Dados de Logística de Transporte movidos para dentro do bloco Cálculo
    if (categoria === 'transporte-coletivo') {
        memoria += `Logística de Transporte:\n`;
        memoria += `- Itinerário: ${details.itinerario || 'N/A'}\n`;
        memoria += `- Distância Itinerário: ${details.distancia_itinerario || 0} Km\n`;
        memoria += `- Distância percorrida/dia: ${details.distancia_percorrida_dia || 0} Km\n`;
        memoria += `- Número de Viagens: ${details.numero_viagens || 1}\n\n`;
    }

    items.forEach((item: any) => {
        // Descrição do item preservando o case original do banco
        memoria += `- ${item.descricao_reduzida || item.descricao_item}: ${formatCurrency(item.valor_unitario)}/${item.unidade_medida || 'un'}.\n`;
    });

    memoria += `\nFórmula: Nr Item x Valor Unitário.\n`;
    
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
            memoria += `- ${qty} ${item.descricao_reduzida || item.descricao_item} (${periodFormatted} ${unit} x ${trips} viagens) x ${formatCurrency(val)}/${unit} = ${formatCurrency(total)}.\n`;
        } else if (categoria === 'fretamento-aereo') {
            memoria += `- ${qty} ${item.descricao_reduzida || item.descricao_item} x ${formatCurrency(val)}/${unit} = ${formatCurrency(total)}.\n`;
        } else {
            memoria += `- ${qty} ${item.descricao_reduzida || item.descricao_item} (${periodFormatted} ${unit}) x ${formatCurrency(val)}/${unit} = ${formatCurrency(total)}.\n`;
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