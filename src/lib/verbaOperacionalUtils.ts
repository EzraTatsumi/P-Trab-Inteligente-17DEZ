import { formatCurrency } from "./formatUtils";

export interface VerbaOperacionalRegistro {
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    quantidade_equipes: number;
    valor_total_solicitado: number;
    fase_atividade: string;
    valor_nd_30: number;
    valor_nd_39: number;
    objeto_aquisicao: string;
    objeto_contratacao: string;
    proposito: string;
    finalidade: string;
    local: string;
    tarefa: string;
}

export function calculateVerbaOperacionalTotals(data: VerbaOperacionalRegistro) {
    return {
        totalGeral: data.valor_total_solicitado,
        totalND30: data.valor_nd_30,
        totalND39: data.valor_nd_39,
    };
}

export function generateVerbaOperacionalMemoriaCalculo(data: VerbaOperacionalRegistro): string {
    const total = data.valor_total_solicitado;
    
    return `MEMÓRIA DE CÁLCULO - VERBA OPERACIONAL

1. DADOS DA SOLICITAÇÃO:
   - OM Favorecida: ${data.organizacao} (UG: ${data.ug})
   - OM Detentora: ${data.om_detentora} (UG: ${data.ug_detentora})
   - Período: ${data.dias_operacao} dias
   - Efetivo: ${data.quantidade_equipes} militares
   - Fase: ${data.fase_atividade}

2. DETALHAMENTO DA APLICAÇÃO:
   - Objeto (Material): ${data.objeto_aquisicao}
   - Objeto (Serviço): ${data.objeto_contratacao}
   - Propósito: ${data.proposito}
   - Finalidade: ${data.finalidade}
   - Local: ${data.local}
   - Tarefa: ${data.tarefa}

3. DISTRIBUIÇÃO POR NATUREZA DE DESPESA:
   - ND 33.90.30 (Material): ${formatCurrency(data.valor_nd_30)}
   - ND 33.90.39 (Serviço): ${formatCurrency(data.valor_nd_39)}

VALOR TOTAL SOLICITADO: ${formatCurrency(total)}`;
}