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
        
        // Assumimos que o item de aquisição já tem a ND definida
        if (item.nd === '33.90.30') {
            totalND30 += value;
        } else if (item.nd === '33.90.39') {
            totalND39 += value;
        } else {
            // Fallback: se a ND não estiver definida, assume ND 30 (padrão para material de consumo)
            totalND30 += value;
        }
    });

    return { totalValue, totalND30, totalND39 };
}

/**
 * Gera a memória de cálculo consolidada para um grupo de Material de Consumo.
 */
export function generateConsolidatedMaterialConsumoMemoriaCalculo(group: ConsolidatedMaterialConsumoRecord): string {
    const omNome = group.organizacao;
    const fase = group.fase_atividade || 'Não Definida';
    const efetivo = group.efetivo;
    const dias = group.dias_operacao;
    
    // Concordância
    const militarText = efetivo === 1 ? "militar" : "militares";
    const diaText = dias === 1 ? "dia" : "dias";
    
    let memorias: string[] = [];
    
    group.records.forEach((registro) => {
        const groupName = registro.group_name;
        const itens = (registro.itens_aquisicao as unknown as ItemAquisicao[]) || [];
        
        // Cabeçalho do Grupo
        let texto = `33.90.30 - Aquisição de ${groupName} para atender ${efetivo} ${militarText} do/da ${omNome}, durante ${dias} ${diaText} de ${fase}.\n\n`;
        
        texto += `Cálculo:\n`;
        texto += `Fórmula: Qtd do item x Valor do item.\n`;
        
        // Listagem de Itens
        const pregoesSet = new Set<string>();
        const uasgsSet = new Set<string>();

        itens.forEach(item => {
            const nomeItem = item.descricao_reduzida || item.descricao_item;
            texto += `- ${item.quantidade} ${nomeItem} x ${formatCurrency(item.valor_unitario)}/unid. = ${formatCurrency(item.valor_total)}.\n`;
            
            if (item.numero_pregao) pregoesSet.add(formatPregao(item.numero_pregao));
            if (item.uasg) uasgsSet.add(formatCodug(item.uasg));
        });
        
        texto += `Total: ${formatCurrency(registro.valor_total)}.\n`;
        
        // Rodapé de Pregão/UASG
        const pregoes = Array.from(pregoesSet).join(', ');
        const uasgs = Array.from(uasgsSet).join(', ');
        
        if (pregoes || uasgs) {
            texto += `(Pregão: ${pregoes || 'N/A'} - ${uasgs || 'N/A'}).`;
        }
        
        memorias.push(texto);
    });
    
    // Une as memórias de cada grupo com uma quebra de linha dupla
    return memorias.join('\n\n----------------------------------------------------------------\n\n');
}