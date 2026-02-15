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
    
    const prep = getOmPreposition(registro.organizacao);
    const art = getOmArticle(registro.organizacao);
    const fase = registro.fase_atividade || 'Planejamento';
    const diasText = registro.dias_operacao === 1 ? "dia" : "dias";
    const milText = registro.efetivo === 1 ? "militar" : "militares";

    // --- CATEGORIA: OUTROS ---
    if (categoria === 'outros') {
        const hasND33 = items.some((i: any) => i.natureza_despesa === '33');
        const hasND39 = items.some((i: any) => i.natureza_despesa === '39' || !i.natureza_despesa);
        const ndHeader = (hasND33 && hasND39) ? '33.90.33 / 33.90.39' : (hasND33 ? '33.90.33' : '33.90.39');
        
        const catLabel = details.nome_servico_outros || 'Serviços de Terceiros';
        const tipoContrato = details.tipo_contrato_outros === 'locacao' ? 'Locação' : 'Contratação';

        const beneficiary = details.has_efetivo
            ? `para atender ${registro.efetivo} ${milText} ${prep} ${registro.organizacao}`
            : `para atender ${art} ${registro.organizacao}`;

        let memoria = `${ndHeader} - ${tipoContrato} de ${catLabel} ${beneficiary}, durante ${registro.dias_operacao} ${diasText} de ${fase}.\n\n`;
        
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

    // --- CATEGORIA: FRETAMENTO AÉREO ---
    if (categoria === 'fretamento-aereo') {
        const item = items[0];
        if (!item) return "Nenhum item selecionado.";
        
        let memoria = `33.90.33 - Contratação de Fretamento Aéreo para o transporte de ${registro.efetivo} ${milText} ${prep} ${registro.organizacao}, durante ${registro.dias_operacao} ${diasText} de ${fase}.\n\n`;
        
        memoria += `Cálculo:\n`;
        memoria += `- Tipo Anv: ${details.tipo_anv || 'N/A'}.\n`;
        memoria += `- Capacidade: ${details.capacidade || 'N/A'}.\n`;
        memoria += `- Velocidade de Cruzeiro: ${details.velocidade_cruzeiro || 0} Km/h.\n`;
        memoria += `- Distância a percorrer: ${formatNumber(details.distancia_percorrer || 0, 0)} Km.\n`;
        memoria += `- Valor da HV: ${formatCurrency(item.valor_unitario)}/HV.\n\n`;
        
        memoria += `Fórmula: Quantidade de HV (Dist / Vel) x valor da HV.\n`;
        memoria += `- ${item.quantidade} HV x ${formatCurrency(item.valor_unitario)}/HV = ${formatCurrency(registro.valor_total)}.\n\n`;
        
        memoria += `Total: ${formatCurrency(registro.valor_total)}.\n`;
        memoria += `(Pregão ${formatPregao(item.numero_pregao)} - UASG ${formatCodug(item.uasg)})`;
        return memoria;
    }

    // --- CATEGORIA: TRANSPORTE COLETIVO ---
    if (categoria === 'transporte-coletivo') {
        const trips = Number(details.numero_viagens) || 1;
        let memoria = `33.90.33 - Contratação de veículos do tipo Transporte Coletivo para transporte de ${registro.efetivo} ${milText} ${prep} ${registro.organizacao}, durante ${registro.dias_operacao} ${diasText} de ${fase}.\n\n`;
        
        memoria += `Cálculo:\n`;
        memoria += `- Itn Dslc: ${details.itinerario || 'N/A'}.\n`;
        memoria += `- Dist Itn: ${details.distancia_itinerario || 0} Km.\n`;
        memoria += `- Dist Percorrida/dia: ${details.distancia_percorrida_dia || 0} Km.\n`;
        memoria += `- Nr Viagens: ${trips}.\n`;
        
        items.forEach((i: any) => {
            memoria += `- ${i.descricao_reduzida || i.descricao_item}: ${formatCurrency(i.valor_unitario)}/${i.unidade_medida || 'un'}.\n`;
        });

        memoria += `\nFórmula: (Nr Item x Valor Unitário x Período) x Nr Viagens.\n`;
        
        items.forEach((i: any) => {
            const qty = i.quantidade || 0;
            const vlrUnit = i.valor_unitario || 0;
            const period = i.periodo || 0;
            const unit = i.unidade_medida || 'un';
            const periodFormatted = period.toString().replace('.', ',');
            const multiplier = (i.sub_categoria === 'servico-adicional') ? 1 : trips;
            const totalItem = qty * vlrUnit * period * multiplier;
            
            if (i.sub_categoria === 'servico-adicional') {
                memoria += `- ${qty} ${i.descricao_reduzida || i.descricao_item} (${periodFormatted} ${unit}) x ${formatCurrency(vlrUnit)}/${unit} = ${formatCurrency(totalItem)}.\n`;
            } else {
                memoria += `- (${qty} ${i.descricao_reduzida || i.descricao_item} x ${formatCurrency(vlrUnit)} x ${periodFormatted} ${unit}) x ${trips} ${trips === 1 ? 'viagem' : 'viagens'} = ${formatCurrency(totalItem)}.\n`;
            }
        });

        memoria += `\nTotal: ${formatCurrency(registro.valor_total)}.\n`;
        if (items.length > 0) {
            memoria += `(Pregão ${formatPregao(items[0].numero_pregao)} - UASG ${formatCodug(items[0].uasg)})`;
        }
        return memoria;
    }

    // --- CATEGORIA: SERVIÇO SATELITAL ---
    if (categoria === 'servico-satelital') {
        const tipo = details.tipo_equipamento || 'N/A';
        const prop = details.proposito || 'N/A';
        let memoria = `33.90.39 - Contratação de Serviço Satelital de ${tipo}, visando ${prop}, durante ${registro.dias_operacao} ${diasText} de ${fase}.\n\n`;
        
        memoria += `Cálculo:\n`;
        items.forEach((item: any) => {
            memoria += `- ${item.descricao_reduzida || item.descricao_item}: ${formatCurrency(item.valor_unitario)}/${item.unidade_medida || 'un'}.\n`;
        });

        memoria += `\nFórmula: (Nr Eqp x Valor Contrato) x Período do Contrato.\n`;
        items.forEach((item: any) => {
            const unit = item.unidade_medida || 'un';
            const period = item.periodo || 0;
            const qty = item.quantidade || 0;
            const vlrUnit = item.valor_unitario || 0;
            const totalItem = qty * period * vlrUnit;
            const periodFormatted = period.toString().replace('.', ',');
            
            memoria += `- (${qty} ${item.descricao_reduzida || item.descricao_item} x ${formatCurrency(vlrUnit)}/${unit}) x ${periodFormatted} ${unit}${period > 1 ? 's' : ''} = ${formatCurrency(totalItem)}.\n`;
        });

        memoria += `\nTotal: ${formatCurrency(registro.valor_total)}.\n`;
        if (items.length > 0) {
            memoria += `(Pregão ${formatPregao(items[0].numero_pregao)} - UASG ${formatCodug(items[0].uasg)})`;
        }
        return memoria;
    }

    // --- CATEGORIA: LOCAÇÃO DE VEÍCULOS ---
    if (categoria === 'locacao-veiculos') {
        const groupName = registro.group_name || details?.group_name || 'Grupo de Veículos';
        let memoria = `33.90.33 - Contratação de Locação de Veículos (${groupName}), para a ${registro.organizacao}, durante ${registro.dias_operacao} ${diasText} de ${fase}.\n\n`;
        
        memoria += `Cálculo:\n`;
        items.forEach((item: any) => {
            memoria += `- ${item.descricao_reduzida || item.descricao_item}: ${formatCurrency(item.valor_unitario)}/${item.unidade_medida || 'un'}.\n`;
        });

        memoria += `\nFórmula: Nr Item x Valor Unitário x Período.\n`;
        items.forEach((item: any) => {
            const qty = item.quantidade || 0;
            const period = item.periodo || 0;
            const unit = item.unidade_medida || 'un';
            const val = item.valor_unitario || 0;
            const total = qty * period * val;
            const periodFormatted = period.toString().replace('.', ',');

            memoria += `- ${qty} ${item.descricao_reduzida || item.descricao_item} (${periodFormatted} ${unit}) x ${formatCurrency(val)}/${unit} = ${formatCurrency(total)}.\n`;
        });

        memoria += `\nTotal: ${formatCurrency(registro.valor_total)}.\n`;
        if (items.length > 0) {
            memoria += `(Pregão ${formatPregao(items[0].numero_pregao)} - UASG ${formatCodug(items[0].uasg)})`;
        }
        return memoria;
    }

    // --- DEMAIS CATEGORIAS (ESTRUTURAS, GRÁFICO) ---
    const nd = '33.90.39';
    const catLabel = formatCategoryLabel(categoria);
    let memoria = `${nd} - Contratação de ${catLabel}, para a ${registro.organizacao}, durante ${registro.dias_operacao} ${diasText} de ${fase}.\n\n`;

    memoria += `Cálculo:\n`;
    items.forEach((item: any) => {
        memoria += `- ${item.descricao_reduzida || item.descricao_item}: ${formatCurrency(item.valor_unitario)}/${item.unidade_medida || 'un'}.\n`;
    });

    memoria += `\nFórmula: Nr Item x Valor Unitário x Período.\n`;
    items.forEach((item: any) => {
        const qty = item.quantidade || 0;
        const period = item.periodo || 0;
        const unit = item.unidade_medida || 'un';
        const val = item.valor_unitario || 0;
        const total = qty * period * val;
        const periodFormatted = period.toString().replace('.', ',');

        memoria += `- ${qty} ${item.descricao_reduzida || item.descricao_item} (${periodFormatted} ${unit}) x ${formatCurrency(val)}/${unit} = ${formatCurrency(total)}.\n`;
    });

    memoria += `\nTotal: ${formatCurrency(registro.valor_total)}.\n`;
    if (items.length > 0) {
        memoria += `(Pregão ${formatPregao(items[0].numero_pregao)} - UASG ${formatCodug(items[0].uasg)})`;
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