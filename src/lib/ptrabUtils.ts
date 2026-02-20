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
    const { data, error } = await (supabase.from(tableName) as any)
        .select('*')
        .eq('p_trab_id', ptrabId);

    if (error) {
        throw new Error(`Falha ao carregar registros de ${String(tableName)}: ${error.message}`);
    }
    
    return data as Tables<T>[];
}

/**
 * Busca os totais de múltiplos PTrabs de uma vez para otimização de performance.
 */
export async function fetchBatchPTrabTotals(ptrabIds: string[]) {
  if (ptrabIds.length === 0) return {};

  const tables = [
    { name: 'classe_i_registros', fields: 'p_trab_id, total_qs, total_qr, quantidade_r2, quantidade_r3' },
    { name: 'classe_ii_registros', fields: 'p_trab_id, valor_total' },
    { name: 'classe_iii_registros', fields: 'p_trab_id, valor_total' },
    { name: 'classe_v_registros', fields: 'p_trab_id, valor_total' },
    { name: 'classe_vi_registros', fields: 'p_trab_id, valor_total' },
    { name: 'classe_vii_registros', fields: 'p_trab_id, valor_total' },
    { name: 'classe_viii_saude_registros', fields: 'p_trab_id, valor_total' },
    { name: 'classe_viii_remonta_registros', fields: 'p_trab_id, valor_total' },
    { name: 'classe_ix_registros', fields: 'p_trab_id, valor_total' },
    { name: 'diaria_registros', fields: 'p_trab_id, valor_nd_15, valor_nd_30' },
    { name: 'verba_operacional_registros', fields: 'p_trab_id, valor_nd_30, valor_nd_39' },
    { name: 'passagem_registros', fields: 'p_trab_id, valor_nd_33' },
    { name: 'concessionaria_registros', fields: 'p_trab_id, valor_nd_39' },
    { name: 'horas_voo_registros', fields: 'p_trab_id, valor_nd_30, valor_nd_39, quantidade_hv' },
    { name: 'material_consumo_registros', fields: 'p_trab_id, valor_nd_30, valor_nd_39' },
    { name: 'complemento_alimentacao_registros', fields: 'p_trab_id, valor_total' },
    { name: 'servicos_terceiros_registros', fields: 'p_trab_id, valor_total' },
    { name: 'material_permanente_registros', fields: 'p_trab_id, valor_total' },
  ];

  const results = await Promise.all(
    tables.map(table => 
      (supabase.from(table.name as any) as any)
        .select(table.fields)
        .in('p_trab_id', ptrabIds)
    )
  );

  const totalsMap: Record<string, any> = {};
  ptrabIds.forEach(id => {
    totalsMap[id] = {
      totalLogistica: 0,
      totalOperacional: 0,
      totalMaterialPermanente: 0,
      quantidadeRacaoOp: 0,
      quantidadeHorasVoo: 0
    };
  });

  results.forEach((res, index) => {
    if (res.error || !res.data) return;
    const tableName = tables[index].name;
    
    res.data.forEach((record: any) => {
      const pid = record.p_trab_id;
      if (!totalsMap[pid]) return;

      if (tableName === 'classe_i_registros') {
        totalsMap[pid].totalLogistica += (record.total_qs || 0) + (record.total_qr || 0);
        totalsMap[pid].quantidadeRacaoOp += (record.quantidade_r2 || 0) + (record.quantidade_r3 || 0);
      } else if (['classe_ii_registros', 'classe_iii_registros', 'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 'classe_viii_saude_registros', 'classe_viii_remonta_registros', 'classe_ix_registros'].includes(tableName)) {
        totalsMap[pid].totalLogistica += (record.valor_total || 0);
      } else if (tableName === 'material_permanente_registros') {
        totalsMap[pid].totalMaterialPermanente += (record.valor_total || 0);
      } else if (tableName === 'horas_voo_registros') {
        totalsMap[pid].totalOperacional += (record.valor_nd_30 || 0) + (record.valor_nd_39 || 0);
        totalsMap[pid].quantidadeHorasVoo += (record.quantidade_hv || 0);
      } else if (tableName === 'diaria_registros') {
        totalsMap[pid].totalOperacional += (record.valor_nd_15 || 0) + (record.valor_nd_30 || 0);
      } else if (tableName === 'verba_operacional_registros' || tableName === 'material_consumo_registros') {
        totalsMap[pid].totalOperacional += (record.valor_nd_30 || 0) + (record.valor_nd_39 || 0);
      } else if (tableName === 'passagem_registros') {
        totalsMap[pid].totalOperacional += (record.valor_nd_33 || 0);
      } else if (tableName === 'concessionaria_registros') {
        totalsMap[pid].totalOperacional += (record.valor_nd_39 || 0);
      } else if (tableName === 'complemento_alimentacao_registros' || tableName === 'servicos_terceiros_registros') {
        totalsMap[pid].totalOperacional += (record.valor_total || 0);
      }
    });
  });

  return totalsMap;
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