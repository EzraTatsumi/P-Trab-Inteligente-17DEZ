import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type DiretrizCusteio = Tables<'diretrizes_custeio'>;

/**
 * Busca as diretrizes de custeio (valores unitários de Classe I e fatores de Classe III) 
 * para o ano de referência fornecido.
 * @param year O ano de referência para buscar a diretriz.
 */
export async function fetchDiretrizesCusteio(year: number): Promise<DiretrizCusteio> {
    if (!year) throw new Error("Ano de referência não fornecido.");
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");
    
    // Busca a diretriz diretamente pelo ano e user_id
    const { data, error } = await supabase
        .from('diretrizes_custeio')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano_referencia', year)
        .maybeSingle();
        
    if (error) {
        console.error("Erro ao buscar diretriz de custeio:", error);
        throw new Error(`Falha ao buscar diretrizes de custeio para o ano ${year}.`);
    }
    
    if (!data) {
        throw new Error(`Diretrizes de Custeio não encontradas para o ano ${year}. Por favor, cadastre-as em 'Configurações > Diretrizes de Custeio'.`);
    }
    
    return data as DiretrizCusteio;
}

/**
 * Busca o ano padrão de logística (default_logistica_year) do perfil do usuário.
 * Esta função substitui a busca incorreta por 'default_diretriz_year'.
 */
export async function fetchDefaultLogisticaYearFromProfile(): Promise<number | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // A coluna correta é default_logistica_year
    const { data, error } = await supabase
        .from('profiles')
        .select('default_logistica_year')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error("Erro ao buscar default_logistica_year:", error);
        return null;
    }

    return data?.default_logistica_year ?? null;
}