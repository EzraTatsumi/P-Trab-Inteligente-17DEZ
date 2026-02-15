import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatPregao, formatCodug } from "./formatUtils";

export interface MaterialPermanenteRegistro {
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
    detalhes_planejamento: {
        itens_selecionados: ItemAquisicao[];
        has_efetivo?: boolean;
    };
    valor_total: number;
    valor_nd_52: number;
    detalhamento_customizado: string | null;
    created_at: string;
}

export const calculateMaterialPermanenteTotals = (items: ItemAquisicao[]) => {
    const total = items.reduce((acc, item) => {
        const qty = item.quantidade || 0;
        return acc + (qty * item.valor_unitario);
    }, 0);

    return {
        totalGeral: total,
        totalND52: total
    };
};

export const generateMaterialPermanenteMemoria = (registro: any): string => {
    const { organizacao, ug, dias_operacao, efetivo, detalhes_planejamento } = registro;
    const itens = detalhes_planejamento?.itens_selecionados || [];
    const hasEfetivo = detalhes_planejamento?.has_efetivo !== false;

    let memoria = `PLANEJAMENTO DE AQUISIÇÃO DE MATERIAL PERMANENTE (GND 4)\n`;
    memoria += `--------------------------------------------------\n`;
    memoria += `OM Solicitante: ${organizacao} (UG: ${formatCodug(ug)})\n`;
    memoria += `Período da Operação: ${dias_operacao} dias\n`;
    if (hasEfetivo && efetivo > 0) {
        memoria += `Efetivo Apoiado: ${efetivo} militares\n`;
    }
    memoria += `\nITENS PLANEJADOS:\n`;

    itens.forEach((item: ItemAquisicao, index: number) => {
        const totalItem = (item.quantidade || 0) * item.valor_unitario;
        memoria += `${index + 1}. ${item.descricao_reduzida || item.descricao_item}\n`;
        memoria += `   CATMAT: ${item.codigo_catmat} | Pregão: ${formatPregao(item.numero_pregao)} | UASG: ${formatCodug(item.uasg)}\n`;
        memoria += `   Cálculo: ${item.quantidade} un. x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(totalItem)}\n\n`;
    });

    memoria += `--------------------------------------------------\n`;
    memoria += `VALOR TOTAL DO LOTE (ND 44.90.52): ${formatCurrency(registro.valor_total)}`;

    return memoria;
};