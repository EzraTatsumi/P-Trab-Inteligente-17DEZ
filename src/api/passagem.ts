import { supabase } from "@/integrations/supabase/client";
import { PassagemRegistro, PassagemResumo } from "@/types/passagem";

const TABLE_NAME = 'passagem_registros';

export const getPassagemRegistros = async (ptrabId: string): Promise<PassagemRegistro[]> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('p_trab_id', ptrabId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data as PassagemRegistro[];
};

export const createPassagemRegistro = async (registro: PassagemRegistroInsert): Promise<PassagemRegistro> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(registro)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as PassagemRegistro;
};

export const updatePassagemRegistro = async (id: string, registro: PassagemRegistroUpdate): Promise<PassagemRegistro> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(registro)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as PassagemRegistro;
};

export const deletePassagemRegistro = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
};

export const getPassagemResumo = async (ptrabId: string): Promise<PassagemResumo> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('quantidade_passagens, valor_nd_33')
    .eq('p_trab_id', ptrabId);

  if (error) throw new Error(error.message);

  const resumo: PassagemResumo = data.reduce((acc, registro) => {
    acc.total_passagens += registro.quantidade_passagens || 0;
    acc.total_nd_33 += parseFloat(registro.valor_nd_33 as unknown as string) || 0;
    return acc;
  }, { total_passagens: 0, total_nd_33: 0 });

  return resumo;
};