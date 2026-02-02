import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

/**
 * Tipo de dados para a Diretriz de Concessionária.
 */
export type DiretrizConcessionaria = Tables<'diretrizes_concessionaria'>;

/**
 * Busca as diretrizes de concessionária com base em uma lista de IDs.
 * @param diretrizIds Array de IDs das diretrizes a serem buscadas.
 * @returns Uma promessa que resolve para um array de objetos DiretrizConcessionaria.
 */
export async function fetchDiretrizesConcessionaria(diretrizIds: string[]): Promise<DiretrizConcessionaria[]> {
    if (diretrizIds.length === 0) {
        return [];
    }
    
    const { data, error } = await supabase
        .from('diretrizes_concessionaria')
        .select('*')
        .in('id', diretrizIds);

    if (error) {
        console.error("Erro ao buscar diretrizes de concessionária:", error);
        throw new Error("Falha ao carregar diretrizes de concessionária.");
    }
    
    return data as DiretrizConcessionaria[];
}