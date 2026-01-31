import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type VerbaOperacionalRegistro = Tables<'verba_operacional_registros'>;

interface VerbaOperacionalResumo {
  total_nd_30: number;
  total_nd_39: number;
}

const fetchVerbaOperacionalResumo = async (ptrabId: string): Promise<VerbaOperacionalResumo> => {
  const { data, error } = await supabase
    .from('verba_operacional_registros')
    .select('valor_nd_30, valor_nd_39')
    .eq('p_trab_id', ptrabId);

  if (error) {
    throw new Error(`Erro ao buscar resumo de verba operacional: ${error.message}`);
  }

  const total_nd_30 = (data || []).reduce((sum, record) => sum + (record.valor_nd_30 || 0), 0);
  const total_nd_39 = (data || []).reduce((sum, record) => sum + (record.valor_nd_39 || 0), 0);

  return { total_nd_30, total_nd_39 };
};

export const useVerbaOperacionalResumo = (ptrabId: string) => {
  return useQuery<VerbaOperacionalResumo, Error>({
    queryKey: ['verbaOperacionalResumo', ptrabId],
    queryFn: () => fetchVerbaOperacionalResumo(ptrabId),
    enabled: !!ptrabId,
  });
};