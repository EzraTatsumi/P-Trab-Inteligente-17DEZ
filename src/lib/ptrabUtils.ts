import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables, TableName } from "@/integrations/supabase/types";
import { PTrabData } from "@/types/ptrab"; // Importando o tipo PTrabData do novo arquivo

// Tipo para as diretrizes operacionais (valores unitários)
type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

// Define a união de tabelas que possuem a coluna p_trab_id
type PTrabLinkedTableName =
    'classe_i_registros' | 'classe_ii_registros' | 'classe_iii_registros' | 
    'classe_v_registros' | 'classe_vi_registros' | 'classe_vii_registros' | 
    'classe_viii_saude_registros' | 'classe_viii_remonta_registros' | 
    'classe_ix_registros' | 'p_trab_ref_lpc' | 'passagem_registros' | 
    'diaria_registros' | 'verba_operacional_registros';

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
 * @param tableName O nome da tabela (deve ser uma chave válida de Tables).
 * @param ptrabId O ID do PTrab.
 */
export async function fetchPTrabRecords<T extends PTrabLinkedTableName>(tableName: T, ptrabId: string): Promise<Tables<T>[]> {
    // O cast para 'TableName' é necessário para satisfazer a tipagem dinâmica do from()
    const { data, error } = await supabase
        .from(tableName as TableName)
        .select('*')
        .eq('p_trab_id', ptrabId);

    if (error) {
        throw new Error(`Falha ao carregar registros de ${String(tableName)}: ${error.message}`);
    }
    
    // O retorno é um array de Rows da tabela T, tipado corretamente por Tables<T>
    return data as Tables<T>[];
}

/**
 * Busca as diretrizes operacionais (custos operacionais e diárias) para o ano de referência fornecido.
 * @param year O ano de referência para buscar a diretriz.
 */
export async function fetchDiretrizesOperacionais(year: number): Promise<DiretrizOperacional> {
    if (!year) throw new Error("Ano de referência não fornecido.");
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");
    
    // Busca a diretriz diretamente pelo ano e user_id
    const { data, error } = await supabase
        .from('diretrizes_operacionais')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano_referencia', year)
        .maybeSingle();
        
    if (error) {
        console.error("Erro ao buscar diretriz operacional:", error);
        throw new Error(`Falha ao buscar diretrizes operacionais para o ano ${year}.`);
    }
    
    if (!data) {
        throw new Error(`Diretrizes Operacionais não encontradas para o ano ${year}. Por favor, cadastre-as em 'Configurações > Custos Operacionais'.`);
    }
    
    return data as DiretrizOperacional;
}