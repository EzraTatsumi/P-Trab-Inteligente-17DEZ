import { formatCurrency } from "./formatUtils";

export interface ItemMaterialPermanente {
    descricao: string;
    quantidade: number;
    valor_unitario: number;
    numero_pregao?: string;
    ug_pregao?: string;
    justificativa?: string;
}

/**
 * Gera a memória de cálculo detalhada para um item de material permanente.
 */
export const generateMaterialPermanenteMemoriaCalculo = (registro: any, item: ItemMaterialPermanente) => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    
    const valorUnitario = Number(item.valor_unitario || 0);
    const quantidade = Number(item.quantidade || 0);
    const total = valorUnitario * quantidade;
    
    let memoria = `44.90.52 - Aquisição de ${item.descricao} para atender as necessidades de ${registro.organizacao}.\n`;
    
    if (item.justificativa) {
        memoria += `${item.justificativa}\n\n`;
    } else {
        memoria += `Justifica-se essa aquisição para garantir a capacidade de suporte às atividades administrativas e operacionais da OM, visando manter a capacidade de trabalho dos diversos setores.\n\n`;
    }
    
    memoria += `Cálculo:\n`;
    memoria += `- ${item.descricao}: ${formatCurrency(valorUnitario)}/ unid.\n\n`;
    memoria += `Fórmula: Qtd do item x Valor do item.\n`;
    memoria += `- ${quantidade} ${item.descricao} x ${formatCurrency(valorUnitario)}/unid = ${formatCurrency(total)}.\n\n`;
    memoria += `Total: ${formatCurrency(total)}.`;
    
    if (item.numero_pregao) {
        memoria += `\n(Pregão ${item.numero_pregao}${item.ug_pregao ? ` - UASG ${item.ug_pregao}` : ''})`;
    }
    
    return memoria;
};