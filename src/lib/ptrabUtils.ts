import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

// Exportando PTrabData para ser usado em formulários e relatórios
export interface PTrabData {
  id: string;
  numero_ptrab: string;
  comando_militar_area: string;
  nome_om: string;
  nome_om_extenso?: string;
  nome_operacao: string;
  periodo_inicio: string;
  periodo_fim: string;
  efetivo_empregado: string;
  acoes: string;
  status: string;
  nome_cmt_om?: string;
  local_om?: string;
  updated_at: string;
  rm_vinculacao: string;
}

// Tipos de tabela válidos para registros de PTrab
type PTrabRecordTable = 
  | 'classe_i_registros'
  | 'classe_ii_registros'
  | 'classe_iii_registros'
  | 'classe_v_registros'
  | 'classe_vi_registros'
  | 'classe_vii_registros'
  | 'classe_viii_saude_registros'
  | 'classe_viii_remonta_registros'
  | 'classe_ix_registros'
  | 'diaria_registros'
  | 'verba_operacional_registros'
  | 'passagem_registros';

/**
 * Busca os registros de uma tabela específica associada a um PTrab.
 */
export async function fetchPTrabRecords<T extends PTrabRecordTable>(
  tableName: T,
  ptrabId: string
): Promise<Tables<T>[]> {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('p_trab_id', ptrabId);

  if (error) {
    console.error(`Erro ao buscar registros de ${tableName}:`, error);
    throw new Error(`Falha ao carregar registros: ${error.message}`);
  }

  return data as Tables<T>[];
}

/**
 * Busca os dados principais do PTrab.
 */
export async function fetchPTrabData(ptrabId: string): Promise<PTrabData> {
  const { data, error } = await supabase
    .from('p_trab')
    .select('*, rm_vinculacao')
    .eq('id', ptrabId)
    .single();

  if (error || !data) {
    console.error("Erro ao buscar dados do P Trab:", error);
    throw new Error("P Trab não encontrado ou erro de carregamento.");
  }

  return data as PTrabData;
}

/**
 * Busca as diretrizes operacionais para um determinado ano.
 */
export async function fetchDiretrizesOperacionais(ano: number): Promise<Tables<'diretrizes_operacionais'> | null> {
  const { data, error } = await supabase
    .from('diretrizes_operacionais')
    .select('*')
    .eq('ano_referencia', ano)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar diretrizes operacionais:", error);
    return null;
  }

  return data;
}