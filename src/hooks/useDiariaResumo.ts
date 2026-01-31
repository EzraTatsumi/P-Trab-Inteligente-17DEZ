import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type DiariaRegistro = Tables<'diaria_registros'>;

interface DiariaResumo {
  total_nd_15: number;
  total_nd_30: number;
}

const fetchDiariaResumo = async (ptrabId: string): Promise<DiariaResumo> => {
  const { data, error } = await supabase
    .from('diaria_registros')
    .select('valor_nd_15, valor_nd_30')
    .eq('p_trab_id', ptrabId);

  if (error) {
    throw new Error(`Erro ao buscar resumo de diárias: ${error.message}`);
  }

  const total_nd_15 = (data || []).reduce((sum, record) => sum + (record.valor_nd_15 || 0), 0);
  const total_nd_30 = (data || []).reduce((sum, record) => sum + (record.valor_nd_30 || 0), 0);

  return { total_nd_15, total_nd_30 };
};

export const useDiariaResumo = (ptrabId: string) => {
  return useQuery<DiariaResumo, Error>({
    queryKey: ['diariaResumo', ptrabId],
    queryFn: () => fetchDiariaResumo(ptrabId),
    enabled: !!ptrabId,
  });
};