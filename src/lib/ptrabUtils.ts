// ... (código anterior)
/**
 * Busca todos os registros de uma tabela específica para um dado PTrab.
 */
export async function fetchPTrabRecords<T extends keyof Tables>(tableName: T, ptrabId: string): Promise<Tables<T>[]> {
    const { data, error } = await supabase
        .from(tableName as keyof Database['public']['Tables'])
        .select('*')
        .eq('p_trab_id', ptrabId);

    if (error) {
        throw new Error(`Falha ao carregar registros de ${String(tableName)}: ${error.message}`);
    }
    
    return data as Tables<T>[];
}
// ... (código restante)