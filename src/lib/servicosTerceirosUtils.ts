import { ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import { formatCurrency, formatCodug, formatPregao } from "./formatUtils";
import { Tables } from "@/integrations/supabase/types";

export type ServicoTerceiroRegistro = Tables<'servicos_terceiros_registros'>;

/**
 * Calcula os totais do lote de serviços, separando por ND.
 * Realiza o cálculo completo: (Quantidade x Período x Valor Unitário) x Multiplicador.
 * Nota: Para Transporte Coletivo, o multiplicador (viagens) não se aplica a serviços adicionais.
 */
export const calculateServicoTotals = (items: ItemAquisicaoServico[], multiplier: number = 1) => {
    return items.reduce((acc, item) => {
        const qty = item.quantidade || 0;
        const period = (item as any).periodo || 0;
        const vlrUnit = item.valor_unitario || 0;
        
        // Lógica do multiplicador: só aplica se NÃO for serviço-adicional
        const isAdditional = (item as any).sub_categoria === 'servico-adicional';
        const itemMultiplier = isAdditional ? 1 : multiplier;
        
        const totalItem = qty * period * vlrUnit * itemMultiplier;
        
        // No banco, a coluna nd armazena '30' ou '39'. 
        // Para transporte (33), o valor vai para a coluna valor_nd_39 no DB, mas aqui separamos pela lógica da dotação.
        if (item.nd === '30') acc.totalND30 += totalItem;
        else acc.totalND39 += totalItem;
        
        acc.totalGeral += totalItem;
        return acc;
    }, { totalGeral: 0, totalND30: 0, totalND39: 0 });
};

/**
 * Gera a memória de cálculo descritiva baseada na categoria e itens.
 */
export const generateMaterialConsumoMemoriaCalculo = (
    registro: Partial<ServicoTerceiroRegistro>,
    context: { organizacao: string, efetivo: number, dias_operacao: number, fase_atividade: string | null }
): string => {
    const { categoria, detalhes_planejamento } = registro;
    const planejamento = detalhes_planejamento as any;
    const items = planejamento?.itens_selecionados || [];
    
    if (items.length === 0) return "Nenhum item selecionado.";

    const prepOM = context.organizacao.includes('ª') ? 'da' : context.organizacao.includes('º') ? 'do' : 'do/da';
    const fase = context.fase_atividade || 'Operação';
    const diasText = context.dias_operacao === 1 ? "dia" : "dias";

    // --- FRETAMENTO AÉREO ---
    if (categoria === 'fretamento-aereo') {
        const item = items[0]; 
        if (!item) return "Nenhum item de fretamento selecionado.";

        const efetivoText = context.efetivo === 1 ? "militar" : "militares";
        const valorTotal = item.valor_total || (item.quantidade * item.valor_unitario);
        
        let texto = `33.90.33 - Contratação de Fretamento Aéreo para o transporte de ${context.efetivo} ${efetivoText} ${prepOM} ${context.organizacao}, durante ${context.dias_operacao} ${diasText} de ${fase}.\n\n`;
        
        texto += `Cálculo:\n`;
        texto += `- Tipo Anv: ${planejamento.tipo_anv || 'N/A'}.\n`;
        texto += `- Capacidade: ${planejamento.capacidade || 'N/A'}.\n`;
        texto += `- Velocidade de Cruzeiro: ${planejamento.velocidade_cruzeiro || 0} Km/h.\n`;
        texto += `- Distância a percorrer: ${planejamento.distancia_percorrer || 0} Km.\n`;
        texto += `- Valor da HV: ${formatCurrency(item.valor_unitario)}/HV.\n\n`;
        
        texto += `Fórmula: Quantidade de HV (Dist / Vel) x valor da HV.\n`;
        texto += `- ${item.quantidade} HV x ${formatCurrency(item.valor_unitario)}/HV = ${formatCurrency(valorTotal)}.\n\n`;
        
        texto += `Total: ${formatCurrency(valorTotal)}.\n`;
        texto += `(Pregão ${formatPregao(item.numero_pregao)} - UASG ${formatCodug(item.uasg)})`;
        
        return texto;
    }

    // --- TRANSPORTE COLETIVO ---
    if (categoria === 'transporte-coletivo') {
        const efetivoText = context.efetivo === 1 ? "militar" : "militares";
        const trips = Number(planejamento.numero_viagens) || 1;
        const valorTotalGeral = Number(registro.valor_total) || 0;

        let texto = `33.90.33 - Contratação de veículos do tipo Transporte Coletivo para transporte de ${context.efetivo} ${efetivoText} ${prepOM} ${context.organizacao}, durante ${context.dias_operacao} ${diasText} de ${fase}.\n\n`;
        
        texto += `Cálculo:\n`;
        texto += `- Itn Dslc: ${planejamento.itinerario || 'N/A'}.\n`;
        texto += `- Dist Itn: ${planejamento.distancia_itinerario || 0} Km.\n`;
        texto += `- Dist Percorrida/dia: ${planejamento.distancia_percorrida_dia || 0} Km.\n`;
        texto += `- Nr Viagens: ${trips}.\n`;
        
        items.forEach((i: any) => {
            const unit = i.unidade_medida || 'UN';
            const limitInfo = (i.has_daily_limit && i.daily_limit_km) ? ` (até ${i.daily_limit_km} Km)` : "";
            texto += `- ${i.descricao_reduzida || i.descricao_item}: ${formatCurrency(i.valor_unitario)}/${unit}${limitInfo}.\n`;
        });

        // Alinhamento da fórmula com 9 espaços para alinhar com o parêntese da linha de cima
        texto += `\nFórmula: (Nr Item x Valor Unitário x Período) x Nr Viagens.\n`;
        texto += `         Qtd Km adicional x Valor Unitário.\n\n`;
        
        items.forEach((i: any) => {
            const qty = i.quantidade || 0;
            const vlrUnit = i.valor_unitario || 0;
            const period = i.periodo || 0;
            const unit = i.unidade_medida || 'un';
            const periodFormatted = period.toString().replace('.', ',');
            
            let unitDisplay = unit;
            if (period > 1) {
                if (unit.toLowerCase() === 'dia') unitDisplay = 'dias';
                else if (unit.toLowerCase() === 'mês') unitDisplay = 'meses';
                else if (unit.toLowerCase() === 'hora') unitDisplay = 'horas';
                else if (unit.toLowerCase() === 'viagem') unitDisplay = 'viagens';
                else if (unit.toLowerCase() === 'km') unitDisplay = 'Km';
            }
            
            const isAdditional = i.sub_categoria === 'servico-adicional';
            const itemMultiplier = isAdditional ? 1 : trips;
            const totalItem = qty * vlrUnit * period * itemMultiplier;
            const tripsText = trips === 1 ? "viagem" : "viagens";
            
            if (isAdditional) {
                texto += `- ${qty} ${i.descricao_reduzida || i.descricao_item} x ${formatCurrency(vlrUnit)}/${unit} = ${formatCurrency(totalItem)}.\n`;
            } else {
                texto += `- (${qty} ${i.descricao_reduzida || i.descricao_item} x ${formatCurrency(vlrUnit)}/${unit} x ${periodFormatted} ${unitDisplay}) x ${trips} ${tripsText} = ${formatCurrency(totalItem)}.\n`;
            }
        });

        texto += `\nTotal: ${formatCurrency(valorTotalGeral)}. \n`;
        
        if (items.length > 0) {
            texto += `(Pregão ${formatPregao(items[0].numero_pregao)} - UASG ${formatCodug(items[0].uasg)})`;
        }
        
        return texto;
    }

    // --- SERVIÇO SATELITAL ---
    if (categoria === 'servico-satelital') {
        const tipoServico = planejamento.tipo_equipamento || '[Tipo de Serviço]';
        const proposito = planejamento.proposito || '[Propósito]';

        let texto = `33.90.39 - Contratação de Serviço ${tipoServico}, visando ${proposito}, durante ${context.dias_operacao} ${diasText} de ${fase}.\n\n`;
        
        texto += `Cálculo:\n`;
        items.forEach((item: any) => {
            const unit = item.unidade_medida || 'UN';
            const vlrUnit = item.valor_unitario || 0;
            const desc = item.descricao_reduzida || item.descricao_item;
            texto += `- ${desc}: ${formatCurrency(vlrUnit)}/${unit}.\n`;
        });

        texto += `\nFórmula: (Nr Eqp x Valor Contrato) x Período do Contrato.\n`;
        items.forEach((item: any) => {
            const unit = item.unidade_medida || 'UN';
            const period = item.periodo || 0;
            const qty = item.quantidade || 0;
            const vlrUnit = item.valor_unitario || 0;
            const desc = item.descricao_reduzida || item.descricao_item;
            const totalItem = item.valor_total || (qty * period * vlrUnit);
            
            const periodFormatted = period.toString().replace('.', ',');
            
            texto += `- (${qty} ${desc} x ${formatCurrency(vlrUnit)}/${unit}) x ${periodFormatted} ${unit}${period > 1 ? 's' : ''} = ${formatCurrency(totalItem)}.\n`;
        });

        const totals = calculateServicoTotals(items);
        texto += `\nTotal: ${formatCurrency(totals.totalGeral)}.\n`;
        
        if (items.length > 0) {
            texto += `(Pregão ${formatPregao(items[0].numero_pregao)} - UASG ${formatCodug(items[0].uasg)})`;
        }
        
        return texto;
    }

    // --- OUTROS SERVIÇOS ---
    const categoriaFormatada = (categoria || "").replace('-', ' ').toUpperCase();
    
    let texto = `MEMÓRIA DE CÁLCULO - ${categoriaFormatada}\n`;
    texto += `--------------------------------------------------\n`;
    texto += `OM FAVORECIDA: ${context.organizacao}\n`;
    texto += `FINALIDADE: Atender às necessidades de ${categoriaFormatada.toLowerCase()} durante a fase de ${fase}, com efetivo de ${context.efetivo} militares, pelo período de ${context.dias_operacao} ${diasText}.\n\n`;
    
    texto += `DETALHAMENTO DOS ITENS:\n`;
    
    items.forEach((item: any, index: number) => {
        const period = item.periodo || 1;
        const totalItem = (item.quantidade || 0) * period * item.valor_unitario;
        texto += `${index + 1}. ${item.descricao_item}\n`;
        texto += `   - Quantidade: ${item.quantidade} ${item.unidade_medida}\n`;
        texto += `   - Valor Unitário: ${formatCurrency(item.valor_unitario)}\n`;
        texto += `   - Subtotal: ${formatCurrency(totalItem)}\n`;
        texto += `   - Amparo: Pregão ${formatPregao(item.numero_pregao)} (UASG: ${formatCodug(item.uasg)})\n\n`;
    });

    const totals = calculateServicoTotals(items);
    texto += `--------------------------------------------------\n`;
    texto += `VALOR TOTAL DO PLANEJAMENTO: ${formatCurrency(totals.totalGeral)}\n`;
    if (totals.totalND30 > 0) texto += `Dotação ND 33.90.30: ${formatCurrency(totals.totalND30)}\n`;
    if (totals.totalND39 > 0) texto += `Dotação ND 33.90.39: ${formatCurrency(totals.totalND39)}\n`;

    return texto;
};

export const generateServicoMemoriaCalculo = generateMaterialConsumoMemoriaCalculo;