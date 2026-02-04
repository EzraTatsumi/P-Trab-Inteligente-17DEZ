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
    const { valor_nd_30, valor_nd_39, quantidade_hv, tipo_anv, amparo } = registro;
    const memoria: string[] = [];
    const totalHv = quantidade_hv.toFixed(2);
    const amparoText = amparo || 'Não Informado';
    
    const isCoter = valor_nd_30 === 0 && valor_nd_39 === 0;

    if (isCoter) {
        return ''; 
    }

    if (valor_nd_30 > 0) {
        // Ajustado conforme solicitado: 33.90.30 – Aquisição de Suprimento de Aviação, referente a <Qtd HV> HV na Anv <Tipo Anv>.
        memoria.push(`33.90.30 – Aquisição de Suprimento de Aviação, referente a ${totalHv} HV na Anv ${tipo_anv}.`);
        memoria.push(`Amparo: ${amparoText}`);
    }

    if (valor_nd_39 > 0) {
        if (valor_nd_30 > 0) {
            memoria.push('');
        }
        // Ajustado conforme solicitado: 33.90.39 – Aquisição de Serviços de Aviação, referente a <Qtd HV> HV na Anv <Tipo Anv>.
        memoria.push(`33.90.39 – Aquisição de Serviços de Aviação, referente a ${totalHv} HV na Anv ${tipo_anv}.`);
        memoria.push(`Amparo: ${amparoText}`);
    }
    
    return memoria.join('\n');
};

/**
 * Gera a memória de cálculo consolidada para um lote de registros de Horas de Voo.
 * @param group O grupo consolidado de registros.
 * @returns A string da memória de cálculo consolidada.
 */
export const generateConsolidatedHorasVooMemoriaCalculo = (group: ConsolidatedHorasVooRecord): string => {
    const { records } = group;

    const memoria: string[] = [];
    
    // Filtra registros que não são COTER para inclusão na memória
    const nonCoterRecords = records.filter(r => r.valor_nd_30 > 0 || r.valor_nd_39 > 0);

    if (nonCoterRecords.length === 0) {
        return '';
    }

    nonCoterRecords.forEach((registro, index) => {
        const totalHv = registro.quantidade_hv.toFixed(2);
        const amparo = registro.amparo || 'N/I';
        
        // Adiciona separador entre itens se houver mais de um
        if (index > 0) {
            memoria.push('\n--------------------------------------------------\n');
        }
        
        // Removendo a linha de detalhamento extra que estava aqui:
        // memoria.push(`[Item ${index + 1}] - Anv ${registro.tipo_anv} (${totalHv} HV) em ${registro.municipio} (CODUG: ${registro.codug_destino})`);
        
        if (registro.valor_nd_30 > 0) {
            // Ajustado conforme solicitado
            memoria.push(`33.90.30 – Aquisição de Suprimento de Aviação, referente a ${totalHv} HV na Anv ${registro.tipo_anv}.`);
            memoria.push(`Amparo: ${amparo}`);
        }
        
        if (registro.valor_nd_39 > 0) {
            if (registro.valor_nd_30 > 0) {
                memoria.push(''); // Linha em branco entre ND 30 e ND 39 do mesmo item
            }
            // Ajustado conforme solicitado
            memoria.push(`33.90.39 – Aquisição de Serviços de Aviação, referente a ${totalHv} HV na Anv ${registro.tipo_anv}.`);
            memoria.push(`Amparo: ${amparo}`);
        }
    });

    return memoria.join('\n');
};