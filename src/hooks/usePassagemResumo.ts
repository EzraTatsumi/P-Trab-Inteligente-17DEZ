import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type PassagemRegistro = Tables<'passagem_registros'>;

interface PassagemResumo {
  total_nd_33: number;
  total_passagens: number;
}

const fetchPassagemResumo = async (ptrabId: string): Promise<PassagemResumo> => {
  const { data, error } = await supabase
    .from('passagem_registros')
    .select('valor_nd_33, quantidade_passagens')
    .eq('p_trab_id', ptrabId);

  if (error) {
    throw new Error(`Erro ao buscar resumo de passagens: ${error.message}`);
  }

  const total_nd_33 = (data || []).reduce((sum, record) => sum + (record.valor_nd_33 || 0), 0);
  const total_passagens = (data || []).reduce((sum, record) => sum + (record.quantidade_passagens || 0), 0);

  return { total_nd_33, total_passagens };
};

export const usePassagemResumo = (ptrabId: string) => {
  return useQuery<PassagemResumo, Error>({
    queryKey: ['passagemResumo', ptrabId],
    queryFn: () => fetchPassagemResumo(ptrabId),
    enabled: !!ptrabId,
  });
};