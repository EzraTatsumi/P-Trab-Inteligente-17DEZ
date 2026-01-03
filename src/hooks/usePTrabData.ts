import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

type PTrabData = Tables<'p_trab'>;

const fetchPTrabData = async (ptrabId: string): Promise<PTrabData> => {
  if (!ptrabId) {
    throw new Error("ID do P Trab é obrigatório.");
  }

  const { data, error } = await supabase
    .from("p_trab")
    .select("*")
    .eq("id", ptrabId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar dados do P Trab:", error);
    throw new Error("Falha ao carregar dados do Plano de Trabalho.");
  }
  
  if (!data) {
    throw new Error("Plano de Trabalho não encontrado.");
  }

  return data as PTrabData;
};

export const usePTrabData = (ptrabId: string | null | undefined) => {
  return useQuery({
    queryKey: ["ptrabData", ptrabId],
    queryFn: () => fetchPTrabData(ptrabId!),
    enabled: !!ptrabId,
    staleTime: 1000 * 60 * 1, // 1 minute
    onError: (error) => {
      toast.error(error.message);
    }
  });
};