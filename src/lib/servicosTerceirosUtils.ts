import { ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import { formatCurrency, formatCodug, formatPregao, formatNumber } from "./formatUtils";
import { Tables } from "@/integrations/supabase/types";

export type ServicoTerceiroRegistro = Tables<'servicos_terceiros_registros'>;

/**
 * Calcula os totais do lote de serviços, separando por ND.
 */
export const calculateServicoTotals = (items: ItemAquisicaoServico[], multiplier: number = 1) => {
    return items.reduce((acc, item) => {
        const qty = item.quantidade || 0;
        const period = (item as any).periodo || 0;
        const vlrUnit = item.valor_unitario || 0;
        
        const isAdditional = (item as any).sub_categoria === 'servico-adicional';
        const itemMultiplier = isAdditional ? 1 : multiplier;
        
        const totalItem = qty * period * vlrUnit * itemMultiplier;
        
        if (item.nd === '30') acc.totalND30 += totalItem;
        else acc.totalND39 += totalItem;
        
        acc.totalGeral += totalItem;
        return acc;
    }, { totalGeral: 0, totalND30: 0, totalND39: 0 });
};

/**
 * Gera a memória de cálculo descritiva baseada na categoria e itens.
 */
export const generateServicoMemoriaCalculo = (
    registro: Partial<ServicoTerceiroRegistro>,
    context: { organizacao: string, efetivo: number, dias_operacao: number, fase_atividade: string | null }
): string => {
    const { categoria, detalhes_planejamento } = registro;
    const planejamento = detalhes_planejamento as any;
    
    const group_name = (registro as any).group_name || planejamento?.group_name;
    const group_purpose = (registro as any).group_purpose || planejamento?.group_purpose;
    
    const items = planejamento?.itens_selecionados || [];
    
    if (items.length === 0) return "Nenhum item selecionado.";

    const fase = context.fase_atividade || 'Operação';
    const diasText = context.dias_operacao === 1 ? "dia" : "dias";
    const efetivoText = context.efetivo === 1 ? "militar" : "militares";

    const paraOM = context.organizacao.includes('ª') ? 'para a' : context.organizacao.includes('º') ? 'para o' : 'para o/a';

    // --- FRETAMENTO AÉREO ---
    if (categoria === 'fretamento-aereo') {
        const item = items[0]; 
        if (!item) return "Nenhum item de fretamento selecionado.";
        const valorTotal = item.valor_total || (item.quantidade * item.valor_unitario);
        const prepOM = context.organizacao.includes('ª') ? 'da' : context.organizacao.includes('º') ? 'do' : 'do/da';
        
        let texto = `33.90.33 - Contratação de Fretamento Aéreo para o transporte de ${context.efetivo} ${efetivoText} ${prepOM} ${context.organizacao}, durante ${context.dias_operacao} ${diasText} de ${fase}.\n\n`;
        texto += `Cálculo:\n`;
        texto += `- Tipo Anv: ${planejamento.tipo_anv || 'N/A'}.\n`;
        texto += `- Capacidade: ${planejamento.capacidade || 'N/A'}.\n`;
        texto += `- Velocidade de Cruzeiro: ${formatNumber(planejamento.velocidade_cruzeiro, 0)} Km/h.\n`;
        texto += `- Distância a percorrer: ${formatNumber(planejamento.distancia_percorrer, 0)} Km.\n`;
        texto += `- Valor da HV: ${formatCurrency(item.valor_unitario)}/HV.\n\n`;
        texto += `Fórmula: Quantidade de HV (Dist / Vel) x valor da HV.\n`;
        texto += `- ${formatNumber(item.quantidade, 4)} HV x ${formatCurrency(item.valor_unitario)}/HV = ${formatCurrency(valorTotal)}.\n\n`;
        texto += `Total: ${formatCurrency(valorTotal)}.\n`;
        texto += `(Pregão ${formatPregao(item.numero_pregao)} - UASG ${formatCodug(item.uasg)})`;
        return texto;
    }

    // --- TRANSPORTE COLETIVO ---
    if (categoria === 'transporte-coletivo') {
        const trips = Number(planejamento.numero_viagens) || 1;
        const valorTotalGeral = Number(registro.valor_total) || 0;

        let texto = `33.90.33 - Contratação de veículos do tipo Transporte Coletivo para transporte de ${context.efetivo} ${efetivoText} ${paraOM} ${context.organizacao}, durante ${context.dias_operacao} ${diasText} de ${fase}.\n\n`;
        texto += `Cálculo:\n`;
        texto += `- Itn Dslc: ${planejamento.itinerario || 'N/A'}.\n`;
        texto += `- Dist Itn: ${formatNumber(planejamento.distancia_itinerario, 0)} Km.\n`;
        texto += `- Dist Percorrida/dia: ${formatNumber(planejamento.distancia_percorrida_dia, 0)} Km.\n`;
        texto += `- Nr Viagens: ${trips}.\n`;
        
        items.forEach((i: any) => {
            const unit = i.unidade_medida || 'UN';
            texto += `- ${i.descricao_reduzida || i.descricao_item}: ${formatCurrency(i.valor_unitario)}/${unit}.\n`;
        });

        texto += `\nFórmula: (Nr Item x Valor Unitário x Período) x Nr Viagens.\n`;
        texto += `         Qtd Km adicional x Valor Unitário.\n\n`;
        
        items.forEach((i: any) => {
            const qty = i.quantidade || 0;
            const vlrUnit = i.valor_unitario || 0;
            const period = i.periodo || 0;
            const unit = i.unidade_medida || 'un';
            const isAdditional = i.sub_categoria === 'servico-adicional';
            const itemMultiplier = isAdditional ? 1 : trips;
            const totalItem = qty * vlrUnit * period * itemMultiplier;
            
            if (isAdditional) {
                texto += `- ${formatNumber(qty, 4)} ${i.descricao_reduzida || i.descricao_item} x ${formatCurrency(vlrUnit)}/${unit} = ${formatCurrency(totalItem)}.\n`;
            } else {
                texto += `- (${formatNumber(qty, 4)} ${i.descricao_reduzida || i.descricao_item} x ${formatCurrency(vlrUnit)}/${unit} x ${formatNumber(period, 4)} ${unit}${period > 1 ? 's' : ''}) x ${trips} ${trips === 1 ? 'viagem' : 'viagens'} = ${formatCurrency(totalItem)}.\n`;
            }
        });

        texto += `\nTotal: ${formatCurrency(valorTotalGeral)}. \n`;
        if (items.length > 0) texto += `(Pregão ${formatPregao(items[0].numero_pregao)} - UASG ${formatCodug(items[0].uasg)})`;
        return texto;
    }

    // --- LOCAÇÃO DE VEÍCULOS ---
    if (categoria === 'locacao-veiculos') {
        let texto = `33.90.33 - Locação de Veículos (${group_name}), ${paraOM} ${context.organizacao}, durante ${context.dias_operacao} ${diasText} de ${fase}.\n\n`;
        
        texto += `Cálculo:\n`;
        items.forEach((item: any) => {
            const unit = item.unidade_medida || 'dia';
            texto += `- ${item.descricao_reduzida || item.descricao_item}: ${formatCurrency(item.valor_unitario)}/${unit}.\n`;
        });

        texto += `\nFórmula: Nr Veículos x Valor Unitário x Período.\n`;
        items.forEach((item: any) => {
            const qty = item.quantidade || 0;
            const period = item.periodo || 0;
            const unit = item.unidade_medida || 'dia';
            const totalItem = qty * period * item.valor_unitario;
            const itemDiasText = period === 1 ? "dia" : "dias";
            
            texto += `- ${formatNumber(qty, 4)} ${item.descricao_reduzida || item.descricao_item} x ${formatCurrency(item.valor_unitario)}/${unit} x ${formatNumber(period, 4)} ${itemDiasText} = ${formatCurrency(totalItem)}.\n`;
        });

        texto += `\nTotal: ${formatCurrency(Number(registro.valor_total))}.\n`;
        if (items.length > 0) {
            texto += `(Pregão ${formatPregao(items[0].numero_pregao)} - UASG ${formatCodug(items[0].uasg)})`;
        }
        return texto;
    }

    // --- SERVIÇO SATELITAL ---
    if (categoria === 'servico-satelital') {
        const tipoServico = planejamento.tipo_equipamento || '[Tipo de Serviço]';
        const propositoStr = group_purpose || planejamento.proposito || '[Propósito]';
        let texto = `33.90.39 - Contratação de Serviço ${tipoServico}, visando ${propositoStr}, durante ${context.dias_operacao} ${diasText} de ${fase}.\n\n`;
        texto += `Cálculo:\n`;
        items.forEach((item: any) => {
            const unit = item.unidade_medida || 'UN';
            texto += `- ${item.descricao_reduzida || item.descricao_item}: ${formatCurrency(item.valor_unitario)}/${unit}.\n`;
        });
        texto += `\nFórmula: (Nr Eqp x Valor Contrato) x Período do Contrato.\n`;
        items.forEach((item: any) => {
            const unit = item.unidade_medida || 'UN';
            const period = item.periodo || 0;
            const qty = item.quantidade || 0;
            const totalItem = qty * period * item.valor_unitario;
            texto += `- (${formatNumber(qty, 4)} un x ${formatCurrency(item.valor_unitario)}/${unit}) x ${formatNumber(period, 4)} ${unit}${period > 1 ? 's' : ''} = ${formatCurrency(totalItem)}.\n`;
        });
        texto += `\nTotal: ${formatCurrency(Number(registro.valor_total))}.\n`;
        if (items.length > 0) texto += `(Pregão ${formatPregao(items[0].numero_pregao)} - UASG ${formatCodug(items[0].uasg)})`;
        return texto;
    }

    // --- OUTROS SERVIÇOS ---
    const categoriaFormatada = (categoria || "").replace('-', ' ').toUpperCase();
    let texto = `MEMÓRIA DE CÁLCULO - ${categoriaFormatada}\n`;
    texto += `--------------------------------------------------\n`;
    texto += `OM FAVORECIDA: ${context.organizacao}\n`;
    texto += `FINALIDADE: Atender às necessidades de ${categoriaFormatada.toLowerCase()} durante a fase de ${fase}, com efetivo de ${context.efetivo} militares, pelo período de ${context.dias_operacao} ${diasText}.\n\n`;
    
    if (group_purpose) {
        texto += `PROPÓSITO: ${group_purpose}\n\n`;
    }

    texto += `DETALHAMENTO DOS ITENS:\n`;
    items.forEach((item: any, index: number) => {
        const period = item.periodo || 1;
        const totalItem = (item.quantidade || 0) * period * item.valor_unitario;
        texto += `${index + 1}. ${item.descricao_item}\n`;
        texto += `   - Quantidade: ${formatNumber(item.quantidade, 4)} ${item.unidade_medida}\n`;
        texto += `   - Valor Unitário: ${formatCurrency(item.valor_unitario)}\n`;
        texto += `   - Subtotal: ${formatCurrency(totalItem)}\n`;
        texto += `   - Amparo: Pregão ${formatPregao(item.numero_pregao)} (UASG: ${formatCodug(item.uasg)})\n\n`;
    });
    const totals = calculateServicoTotals(items);
    texto += `--------------------------------------------------\n`;
    texto += `VALOR TOTAL DO PLANEJAMENTO: ${formatCurrency(totals.totalGeral)}\n`;
    return texto;
};