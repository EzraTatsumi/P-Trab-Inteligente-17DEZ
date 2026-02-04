import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug, formatNumber } from "./formatUtils";

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
        `MEMÓRIA DE CÁLCULO - HORAS DE VOO (AvEx)`,
        `--------------------------------------------------`,
        `OM Favorecida: ${registro.organizacao} (UG: ${formatCodug(registro.ug)})`,
        `OM Detentora do Recurso: ${registro.om_detentora} (UG: ${formatCodug(registro.ug_detentora)})`,
        `Fase da Atividade: ${registro.fase_atividade || 'Não Informada'}`,
        `Período: ${registro.dias_operacao} dia(s)`,
        `--------------------------------------------------`,
        `Município/Destino: ${municipio} (CODUG: ${registro.codug_destino})`,
        `Tipo de Aeronave: ${tipo_anv}`,
        `Quantidade de Horas de Voo (HV): ${formatNumber(quantidade_hv, 2)} HV`,
        `Amparo Legal/Diretriz: ${amparo || 'Não Informado'}`,
        `--------------------------------------------------`,
        `Custeio ND 33.90.30 (Custeio): ${formatCurrency(valor_nd_30)}`,
        `Custeio ND 33.90.39 (Serviços): ${formatCurrency(valor_nd_39)}`,
        `VALOR TOTAL SOLICITADO: ${formatCurrency(valor_total)}`,
    ].join('\n');

    return memoria;
};

/**
 * Gera a memória de cálculo consolidada para um lote de registros de Horas de Voo.
 * @param group O grupo consolidado de registros.
 * @returns A string da memória de cálculo consolidada.
 */
export const generateConsolidatedHorasVooMemoriaCalculo = (group: ConsolidatedHorasVooRecord): string => {
    const { records } = group;

    const totalHV = records.reduce((sum, record) => sum + record.quantidade_hv, 0);
    const tipoAnv = records[0]?.tipo_anv || 'N/I';
    const amparo = records[0]?.amparo || 'N/I';

    const memoria = [
        `33.90.30 – Aquisição de Suprimento de Aviação, referente a ${formatNumber(totalHV, 2)} HV na Anv ${tipoAnv}.`,
        ``, // Linha em branco adicionada aqui
        amparo,
    ];

    return memoria.join('\n');
};