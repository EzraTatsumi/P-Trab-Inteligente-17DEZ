import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ConcessionariaDiretriz, ConcessionariaRegistro, ConsolidatedConcessionariaRecord } from "@/types/concessionaria";
import { PTrabData } from "@/types/ptrab"; // Assuming PTrabData is defined here or globally

// Zod Schema for form validation
export const ConcessionariaSchema = z.object({
    organizacao: z.string().min(1, "Organização é obrigatória."),
    ug: z.string().min(1, "UG é obrigatória."),
    om_detentora: z.string().optional(),
    ug_detentora: z.string().optional(),
    dias_operacao: z.number().min(1, "Dias de operação deve ser no mínimo 1."),
    efetivo: z.number().min(1, "Efetivo deve ser no mínimo 1."),
    diretriz_id: z.string().uuid("Selecione uma diretriz válida."),
    categoria: z.enum(['AGUA_ESGOTO', 'ENERGIA_ELETRICA'], {
        required_error: "A categoria é obrigatória.",
    }),
    detalhamento_customizado: z.string().optional(),
    fase_atividade: z.string().optional(),
});

export type ConcessionariaSchemaType = z.infer<typeof ConcessionariaSchema>;

// --- Data Fetching Functions ---

/**
 * Fetches all Concessionaria records for a given PTrab ID.
 */
export async function fetchConcessionariaRegistros(ptrabId: string): Promise<ConcessionariaRegistro[]> {
    const { data, error } = await supabase
        .from('concessionaria_registros')
        .select('*')
        .eq('p_trab_id', ptrabId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching concessionaria records:", error);
        throw new Error("Falha ao carregar registros de concessionária.");
    }
    return data as ConcessionariaRegistro[];
}

/**
 * Fetches all active Concessionaria directives for the current user/defaults.
 */
export async function fetchConcessionariaDiretrizes(userId: string, anoReferencia: number): Promise<ConcessionariaDiretriz[]> {
    // Filtra por ano de referência e permite diretrizes sem user_id (padrão) ou com o user_id atual
    const { data, error } = await supabase
        .from('diretrizes_concessionaria')
        .select('*')
        .eq('ano_referencia', anoReferencia)
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order('nome_concessionaria', { ascending: true });

    if (error) {
        console.error("Error fetching concessionaria directives:", error);
        throw new Error("Falha ao carregar diretrizes de concessionária.");
    }
    return data as ConcessionariaDiretriz[];
}

/**
 * Fetches a single Concessionaria directive by ID.
 */
export async function fetchConcessionariaDiretrizById(diretrizId: string): Promise<ConcessionariaDiretriz> {
    const { data, error } = await supabase
        .from('diretrizes_concessionaria')
        .select('*')
        .eq('id', diretrizId)
        .single();

    if (error || !data) {
        console.error("Error fetching concessionaria directive:", error);
        throw new Error("Diretriz de concessionária não encontrada.");
    }
    return data as ConcessionariaDiretriz;
}

// --- Calculation and Consolidation Utilities ---

/**
 * Calculates the total cost for a single concessionaria record.
 * Cost = Efetivo * Dias Operação * Consumo Pessoa/Dia * Custo Unitário
 */
export function calculateConcessionariaCost(
    efetivo: number, 
    diasOperacao: number, 
    consumoPessoaDia: number, 
    valorUnitario: number
): number {
    const total = efetivo * diasOperacao * consumoPessoaDia * valorUnitario;
    return parseFloat(total.toFixed(2));
}

/**
 * Generates consolidated view for the memory of calculation (Seção 3/5).
 * This function groups records by category and OM/UG.
 */
export function generateConsolidatedConcessionariaMemoria(
    registros: ConcessionariaRegistro[],
    diretrizes: ConcessionariaDiretriz[]
): ConsolidatedConcessionariaRecord[] {
    if (!registros || registros.length === 0) return [];

    const diretrizMap = new Map(diretrizes.map(d => [d.id, d]));

    return registros.map(registro => {
        const diretriz = diretrizMap.get(registro.diretriz_id);
        
        if (!diretriz) {
            console.warn(`Diretriz ID ${registro.diretriz_id} not found for record ${registro.id}`);
            // Fallback to use values stored in the record if available
            return {
                id: registro.id,
                categoria: registro.categoria,
                nome_concessionaria: 'Diretriz Não Encontrada',
                organizacao: registro.organizacao,
                ug: registro.ug,
                om_detentora: registro.om_detentora || registro.organizacao,
                ug_detentora: registro.ug_detentora || registro.ug,
                dias_operacao: registro.dias_operacao,
                efetivo: registro.efetivo,
                consumo_pessoa_dia: registro.consumo_pessoa_dia,
                valor_unitario: registro.valor_unitario,
                valor_total: registro.valor_total,
                valor_nd_39: registro.valor_nd_39,
                detalhamento: registro.detalhamento || '',
                detalhamento_customizado: registro.detalhamento_customizado || '',
                fase_atividade: registro.fase_atividade || '',
            };
        }

        return {
            id: registro.id,
            categoria: diretriz.categoria,
            nome_concessionaria: diretriz.nome_concessionaria,
            organizacao: registro.organizacao,
            ug: registro.ug,
            om_detentora: registro.om_detentora || registro.organizacao,
            ug_detentora: registro.ug_detentora || registro.ug,
            dias_operacao: registro.dias_operacao,
            efetivo: registro.efetivo,
            consumo_pessoa_dia: diretriz.consumo_pessoa_dia,
            valor_unitario: diretriz.custo_unitario,
            valor_total: registro.valor_total,
            valor_nd_39: registro.valor_nd_39,
            detalhamento: registro.detalhamento || '',
            detalhamento_customizado: registro.detalhamento_customizado || '',
            fase_atividade: registro.fase_atividade || '',
        };
    });
}