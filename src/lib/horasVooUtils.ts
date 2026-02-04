import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug } from "./formatUtils";

// Tipos de dados
export type HorasVooRegistro = Tables<'horas_voo_registros'>;

// Tipo de dados para o formulário (campos que o usuário preenche)
export interface HorasVooForm {
    codug_destino: string;
    municipio: string;
    quantidade_hv: number;
    tipo_anv: string;
    amparo: string;
    valor_nd_30: number;
    valor_nd_39: number;
}

// Tipo para o registro consolidado (lote)
export interface ConsolidatedHorasVooRecord {
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    fase_atividade: string;
    records: HorasVooRegistro[];
    totalGeral: number;
    totalND30: number;
    totalND39: number;
}

/**
 * Calcula os totais de custeio para um registro de Horas de Voo.
 * @param data Os dados do formulário (incluindo ND 30 e ND 39).
 * @returns O valor total (soma de ND 30 e ND 39).
 */
export const calculateHorasVooTotals = (data: HorasVooForm): { valor_total: number } => {
    const valor_total = data.valor_nd_30 + data.valor_nd_39;
    return { valor_total };
};

/**
 * Gera a memória de cálculo detalhada para um único registro de Horas de Voo.
 * @param registro O registro de Horas de Voo.
 * @returns A string da memória de cálculo.
 */
export const generateHorasVooMemoriaCalculo = (registro: HorasVooRegistro): string => {
    const { valor_total, valor_nd_30, valor_nd_39, quantidade_hv, tipo_anv, municipio, amparo } = registro;

    const memoria = [
        `33.90.30 – Aquisição de Suprimento de Aviação, referente a ${quantidade_hv} HV na Anv ${tipo_anv}.'/n,
        `${amparo}`,
    ].join('\n');

    return memoria;
};

/**
 * Gera a memória de cálculo consolidada para um lote de registros de Horas de Voo.
 * @param group O grupo consolidado de registros.
 * @returns A string da memória de cálculo consolidada.
 */
export const generateConsolidatedHorasVooMemoriaCalculo = (group: ConsolidatedHorasVooRecord): string => {
    const { totalGeral, totalND30, totalND39, records } = group;

    const memoria = [
        `MEMÓRIA DE CÁLCULO CONSOLIDADA - HORAS DE VOO (AvEx)`,
        `--------------------------------------------------`,
        `OM Favorecida: ${group.organizacao} (UG: ${formatCodug(group.ug)})`,
        `OM Detentora do Recurso: ${group.om_detentora} (UG: ${formatCodug(group.ug_detentora)})`,
        `Fase da Atividade: ${group.fase_atividade || 'Não Informada'}`,
        `Período: ${group.dias_operacao} dia(s)`,
        `--------------------------------------------------`,
        `DETALHAMENTO DOS REGISTROS (${records.length} item(ns)):`,
    ];

    records.forEach((registro, index) => {
        memoria.push(
            `\n[Item ${index + 1}]`,
            `  Município: ${registro.municipio} (CODUG: ${registro.codug_destino})`,
            `  Tipo Anv: ${registro.tipo_anv} | Qtd HV: ${registro.quantidade_hv.toFixed(2)}`,
            `  Amparo: ${registro.amparo || 'N/I'}`,
            `  ND 30: ${formatCurrency(registro.valor_nd_30)} | ND 39: ${formatCurrency(registro.valor_nd_39)} | Total: ${formatCurrency(registro.valor_total)}`
        );
    });

    memoria.push(
        `\n--------------------------------------------------`,
        `TOTAL CONSOLIDADO ND 33.90.30 (Custeio): ${formatCurrency(totalND30)}`,
        `TOTAL CONSOLIDADO ND 33.90.39 (Serviços): ${formatCurrency(totalND39)}`,
        `VALOR TOTAL GERAL SOLICITADO: ${formatCurrency(totalGeral)}`,
    );

    return memoria.join('\n');
};