import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatCodug, formatPregao } from "./formatUtils";

// Tipo de registro salvo no banco de dados
export type MaterialConsumoRegistro = Tables<'material_consumo_registros'>;

// Tipo de registro consolidado (para exibição na Seção 4)
export interface ConsolidatedMaterialConsumoRecord {
    groupKey: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string | null;
    records: MaterialConsumoRegistro[];
    totalGeral: number;
    totalND30: number;
    totalND39: number;
}

// Tipo de grupo de aquisição (para gerenciamento na Seção 2)
export interface AcquisitionGroup {
    tempId: string;
    groupName: string;
    groupPurpose: string | null; // Finalidade
    items: ItemAquisicao[]; // Lista de itens importados (do diretrizesMaterialConsumo)
    totalValue: number;
    totalND30: number;
    totalND39: number;
}

/**
 * Calcula os totais de ND 30 e ND 39 para um grupo de aquisição.
 */
export function calculateGroupTotals(items: ItemAquisicao[]): { totalValue: number, totalND30: number, totalND39: number } {
    let totalValue = 0;
    let totalND30 = 0;
    let totalND39 = 0;

    items.forEach(item => {
        const value = Number(item.valor_total || 0);
        totalValue += value;
        
        if (item.nd === '33.90.30') {
            totalND30 += value;
        } else if (item.nd === '33.90.39') {
            totalND39 += value;
        } else {
            totalND30 += value;
        }
    });

    return { totalValue, totalND30, totalND39 };
}

/**
 * Gera a memória de cálculo para um ÚNICO registro (Grupo de Aquisição).
 */
export function generateMaterialConsumoMemoriaCalculo(
    registro: MaterialConsumoRegistro, 
    context: { organizacao: string, efetivo: number, dias_operacao: number, fase_atividade: string | null }
): string {
    const { organizacao, efetivo, dias_operacao, fase_atividade } = context;
    const fase = fase_atividade || 'Não Definida';
    
    // Concordância de Número
    const militarText = efetivo === 1 ? "militar" : "militares";
    const diaText = dias_operacao === 1 ? "dia" : "dias";
    
    // Concordância de Gênero (do/da) baseada em ª ou º
    const artigo = organizacao.includes('ª') ? 'da' : organizacao.includes('º') ? 'do' : 'do/da';
    
    const groupName = registro.group_name;
    const itens = (registro.itens_aquisicao as unknown as ItemAquisicao[]) || [];
    
    // Cabeçalho do Grupo
    let texto = `33.90.30 - Aquisição de ${groupName} para atender ${efetivo} ${militarText} ${artigo} ${organizacao}, durante ${dias_operacao} ${diaText} de ${fase}.\n\n`;
    
    texto += `Cálculo:\n`;
    texto += `Fórmula: Qtd do item x Valor do item.\n`;
    
    // Listagem de Itens e Coleta de Pregões/UASGs
    const pregaoUasgPairs = new Map<string, string>(); // Map para evitar duplicatas de pares exatos

    itens.forEach(item => {
        const nomeItem = item.descricao_reduzida || item.descricao_item;
        texto += `- ${item.quantidade} ${nomeItem} x ${formatCurrency(item.valor_unitario)}/unid. = ${formatCurrency(item.valor_total)}.\n`;
        
        if (item.numero_pregao && item.uasg) {
            const pairKey = `${formatPregao(item.numero_pregao)}|${formatCodug(item.uasg)}`;
            // NOVO PADRÃO: (Pregão <nr Pregão> - UASG <Nr UASG>) sem ponto final
            pregaoUasgPairs.set(pairKey, `(Pregão ${formatPregao(item.numero_pregao)} - UASG ${formatCodug(item.uasg)})`);
        }
    });
    
    // Linha em branco antes do Total
    texto += `\n`;
    texto += `Total: ${formatCurrency(registro.valor_total)}.\n`;
    
    // Rodapé de Pregão/UASG (Um por linha se houver múltiplos)
    if (pregaoUasgPairs.size > 0) {
        pregaoUasgPairs.forEach(line => {
            texto += `${line}\n`;
        });
    }
    
    return texto.trim();
}

/**
 * Gera a memória de cálculo consolidada (mantida para compatibilidade, mas agora usa a função individual).
 */
export function generateConsolidatedMaterialConsumoMemoriaCalculo(group: ConsolidatedMaterialConsumoRecord): string {
    const context = {
        organizacao: group.organizacao,
        efetivo: group.efetivo,
        dias_operacao: group.dias_operacao,
        fase_atividade: group.fase_atividade
    };
    
    return group.records
        .map(r => generateMaterialConsumoMemoriaCalculo(r, context))
        .join('\n\n----------------------------------------------------------------\n\n');
}