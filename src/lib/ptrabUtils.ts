import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { PTrabData } from "@/pages/PTrabReportManager"; // Reutilizando o tipo PTrabData

// Tipo para as diretrizes operacionais (valores unitários)
type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

/**
 * Verifica o status de um PTrab e o atualiza para 'em_andamento' se estiver 'aberto'.
 * @param ptrabId O ID do Plano de Trabalho.
 */
export async function updatePTrabStatusIfAberto(ptrabId: string) {
  try {
    const { data: ptrab, error: fetchError } = await supabase
      .from('p_trab')
      .select('status')
      .eq('id', ptrabId)
      .single();

    if (fetchError) {
      console.error("Erro ao buscar status do PTrab:", fetchError);
      return;
    }

    if (ptrab.status === 'aberto') {
      const { error: updateError } = await supabase
        .from('p_trab')
        .update({ status: 'em_andamento' })
        .eq('id', ptrabId);

      if (updateError) {
        console.error("Erro ao atualizar status do PTrab para 'em_andamento':", updateError);
        toast.error("Erro ao atualizar status do PTrab.");
      }
    }
  } catch (error) {
    console.error("Erro inesperado ao atualizar status do PTrab:", error);
  }
}

/**
 * Busca os dados principais de um PTrab.
 */
export async function fetchPTrabData(ptrabId: string): Promise<PTrabData> {
    const { data, error } = await supabase
        .from('p_trab')
        .select('*, updated_at')
        .eq('id', ptrabId)
        .single();

    if (error || !data) {
        throw new Error("Não foi possível carregar o P Trab.");
    }
    
    return data as PTrabData;
}

/**
 * Busca todos os registros de uma tabela específica para um dado PTrab.
 */
export async function fetchPTrabRecords<T extends keyof Tables>(tableName: T, ptrabId: string): Promise<Tables[T][]> {
    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('p_trab_id', ptrabId);

    if (error) {
        throw new Error(`Falha ao carregar registros de ${tableName}: ${error.message}`);
    }
    
    return data as Tables[T][];
}

/**
 * Busca as diretrizes operacionais (custos operacionais e diárias) para o ano de referência.
 * Prioriza o ano padrão do usuário, se não for encontrado, usa o ano da data de início do PTrab.
 */
export async function fetchDiretrizesOperacionais(dateString: string | undefined): Promise<DiretrizOperacional> {
    const year = dateString ? new Date(dateString).getFullYear() : new Date().getFullYear();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");
    
    // 1. Tenta buscar o ano padrão do perfil
    const { data: profileData } = await supabase
        .from('profiles')
        .select('default_diretriz_year')
        .eq('id', user.id)
        .maybeSingle();
        
    const defaultYear = profileData?.default_diretriz_year || year;
    
    // 2. Tenta buscar a diretriz para o ano padrão
    let { data, error } = await supabase
        .from('diretrizes_operacionais')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano_referencia', defaultYear)
        .maybeSingle();
        
    if (error) console.error("Erro ao buscar diretriz operacional pelo ano padrão:", error);

    // 3. Se não encontrou no ano padrão, tenta buscar no ano do PTrab (se for diferente)
    if (!data && defaultYear !== year) {
        const { data: fallbackData, error: fallbackError } = await supabase
            .from('diretrizes_operacionais')
            .select('*')
            .eq('user_id', user.id)
            .eq('ano_referencia', year)
            .maybeSingle();
            
        if (fallbackError) console.error("Erro ao buscar diretriz operacional pelo ano do PTrab:", fallbackError);
        data = fallbackData;
    }
    
    if (!data) {
        // Se não encontrou nenhuma diretriz, retorna um objeto vazio ou com valores padrão
        throw new Error(`Diretrizes Operacionais não encontradas para o ano ${defaultYear} ou ${year}. Por favor, cadastre-as em 'Configurações > Custos Operacionais'.`);
    }
    
    return data as DiretrizOperacional;
}