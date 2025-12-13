import { supabase } from './client';
import { DiretrizClasseIX } from '@/types/diretrizes';

// --- Classe IX Directives ---

export async function fetchDiretrizesClasseIX(ano: number, userId: string): Promise<DiretrizClasseIX[]> {
  const { data, error } = await supabase
    .from('diretrizes_classe_ix')
    .select('*')
    .eq('ano_referencia', ano)
    .eq('user_id', userId)
    .order('item', { ascending: true });

  if (error) throw new Error(error.message);
  return data as DiretrizClasseIX[];
}

type UpsertClasseIXPayload = Omit<DiretrizClasseIX, 'created_at' | 'updated_at'> & { id?: string };

export async function upsertDiretrizClasseIX(
  payload: UpsertClasseIXPayload
): Promise<DiretrizClasseIX> {
  const { id, ...dataToUpsert } = payload;
  
  // Use onConflict based on unique constraints (user_id, ano_referencia, item)
  const { data, error } = await supabase
    .from('diretrizes_classe_ix')
    .upsert(
      {
        id: id || undefined,
        ...dataToUpsert,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id, ano_referencia, item', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as DiretrizClasseIX;
}