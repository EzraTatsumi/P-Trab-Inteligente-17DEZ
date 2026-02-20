import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables, TableName } from "@/integrations/supabase/types";

// Tipo para as diretrizes operacionais (valores unitários)
type DiretrizOperacional = Tables<'diretrizes_operacionais'>;
// Tipo para as diretrizes de passagens
type DiretrizPassagens = Tables<'diretrizes_passagens'>;

// Define a união de tabelas que possuem a coluna p_trab_id
type PTrabLinkedTableName =
    'classe_i_registros' | 'classe_ii_registros' | 'classe_iii_registros' | 
    'classe_v_registros' | 'classe_vi_registros' | 'classe_vii_registros' |
    'classe_viii_saude_registros' | 'classe_viii_remonta_registros' |
    'classe_ix_registros' | 'p_trab_ref_lpc' | 'passagem_registros' |
    'diaria_registros' | 'verba_operacional_registros' | 'concessionaria_registros' | 
    'horas_voo_registros' | 'material_consumo_registros' | 'complemento_alimentacao_registros' |
    'material_permanente_registros' | 'servicos_terceiros_registros';

/**
 * Tipo de dados para o PTrab principal.
 */
export type PTrabData = Tables<'p_trab'>;

/**
 * Verifica o status de um PTrab e o atualiza para 'em_andamento' se estiver 'aberto'.
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
export async function fetchPTrabRecords<T extends PTrabLinkedTableName>(tableName: T, ptrabId: string): Promise<Tables<T>[]> {
    // Usamos o cast para TableName para satisfazer a restrição do SDK do Supabase
    const { data, error } = await supabase
        .from(tableName as TableName)
        .select('*')
        .eq('p_trab_id', ptrabId);

    if (error) {
        throw new Error(`Falha ao carregar registros de ${String(tableName)}: ${error.message}`);
    }
    
    return data as Tables<T>[];
}

/**
 * Busca os totais de múltiplos PTrabs de uma vez usando a função RPC no banco.
 */
export async function fetchBatchPTrabTotals(ptrabIds: string[]) {
  if (ptrabIds.length === 0) return {};

  try {
    // Chama a função RPC que você criou no Supabase
    const { data, error } = await supabase.rpc('get_ptrab_totals_batch' as any, { 
      p_ptrab_ids: ptrabIds 
    });

    if (error) throw error;

    const totalsMap: Record<string, any> = {};
    
    // Inicializa o mapa com zeros para garantir que todos os IDs tenham dados
    ptrabIds.forEach(id => {
      totalsMap[id] = {
        totalLogistica: 0,
        totalOperacional: 0,
        totalMaterialPermanente: 0,
        quantidadeRacaoOp: 0,
        quantidadeHorasVoo: 0
      };
    });

    // Preenche com os dados retornados do banco
    if (data && Array.isArray(data)) {
      data.forEach((row: any) => {
        totalsMap[row.ptrab_id] = {
          totalLogistica: Number(row.total_logistica || 0),
          totalOperacional: Number(row.total_operacional || 0),
          totalMaterialPermanente: Number(row.total_material_permanente || 0),
          quantidadeRacaoOp: Number(row.quantidade_racao_op || 0),
          quantidadeHorasVoo: Number(row.quantidade_horas_voo || 0)
        };
      });
    }

    return totalsMap;
  } catch (error) {
    console.error("Erro ao buscar totais via RPC:", error);
    // Fallback silencioso para não quebrar a UI
    return {};
  }
}

/**
 * Busca as diretrizes operacionais para o ano de referência fornecido.
 */
export async function fetchDiretrizesOperacionais(year: number): Promise<DiretrizOperacional | null> {
    if (!year) return null;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");
    
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
    
    return data as DiretrizOperacional | null;
}

/**
 * Busca as diretrizes de passagens para o ano de referência fornecido.
 */
export async function fetchDiretrizesPassagens(year: number): Promise<DiretrizPassagens[]> {
    if (!year) return [];
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
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
 * Busca o ano padrão de logística do perfil do usuário.
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
        return null;
    }

    return data?.default_logistica_year ?? null;
}