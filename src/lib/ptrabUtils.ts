import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables, TableName } from "@/integrations/supabase/types";
// Reutilizando o tipo PTrabData

// Tipo para as diretrizes operacionais (valores unitários)
type DiretrizOperacional = Tables<'diretrizes_operacionais'>;
// NOVO TIPO: Tipo para as diretrizes de passagens
type DiretrizPassagens = Tables<'diretrizes_passagens'>;

// Define a união de tabelas que possuem a coluna p_trab_id
type PTrabLinkedTableName =
    'classe_i_registros' | 'classe_ii_registros' | 'classe_iii_registros' | 
    'classe_v_registros' | 'classe_vi_registros' | 'classe_vii_registros' |
    'classe_viii_saude_registros' | 'classe_viii_remonta_registros' |
    'classe_ix_registros' | 'p_trab_ref_lpc' | 'passagem_registros' |
    'diaria_registros' | 'verba_operacional_registros' | 'concessionaria_registros' | 'horas_voo_registros' | 'material_consumo_registros' | 'complemento_alimentacao_registros'; // ADICIONADO

/**
 * Tipo de dados para o PTrab principal.
 */
export type PTrabData = Tables<'p_trab'>; // EXPORTANDO O TIPO AQUI

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
    // A solução é usar 'as any' no construtor da consulta para contornar a rigidez do TypeScript
    // com nomes de tabela dinâmicos, mantendo a tipagem forte no retorno.
    const { data, error } = await (supabase.from(tableName) as any)
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
export async function fetchDiretrizesOperacionais(year: number): Promise<DiretrizOperacional | null> {
    if (!year) return null;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");
    
    // Busca a diretriz diretamente pelo ano e user_id
    const { data, error = null } = await supabase
        .from('diretrizes_operacionais')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano_referencia', year)
        .maybeSingle();
        
    if (error) {
        console.error("Erro ao buscar diretriz operacional:", error);
        return null;
    }
    
    // Retornamos null se não encontrar, em vez de lançar erro, para não quebrar a aplicação
    return data as DiretrizOperacional | null;
}

/**
 * Busca as diretrizes de passagens para o ano de referência fornecido.
 * @param year O ano de referência para buscar a diretriz.
 */
export async function fetchDiretrizesPassagens(year: number): Promise<DiretrizPassagens[]> {
    if (!year) return [];
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    // Busca todas as diretrizes de passagens ativas para o ano e user_id
    const { data, error } = await supabase
        .from('diretrizes_passagens')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano_referencia', year)
        .eq('ativo', true);
        
    if (error) {
        console.error("Erro ao buscar diretrizes de passagens:", error);
        return [];
    }
    
    return data as DiretrizPassagens[];
}

/**
 * Busca o ano padrão de logística (default_logistica_year) do perfil do usuário.
 */
export async function fetchDefaultLogisticaYear(): Promise<number | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('default_logistica_year')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error("Erro ao buscar default_logistica_year:", error);
        // Não lança erro fatal, apenas retorna null para que o app possa usar o ano atual como fallback
        return null;
    }

    return data?.default_logistica_year ?? null;
}