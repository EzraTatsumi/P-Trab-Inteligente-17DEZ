import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./client";
import { DiretrizClasseIX } from "@/types/diretrizesClasseIX";
import { toast } from "sonner";

// --- Fetch Hook ---
export const useFetchDiretrizesClasseIX = () => {
  const fetchDiretrizes = async (): Promise<DiretrizClasseIX[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Fetch the user's default year from profile (or current year if not set)
    const { data: profileData } = await supabase
      .from("profiles")
      .select("default_diretriz_year")
      .eq("id", user.id)
      .maybeSingle();
      
    const targetYear = profileData?.default_diretriz_year || new Date().getFullYear();

    const { data, error } = await supabase
      .from("diretrizes_classe_ix")
      .select("*")
      .eq("user_id", user.id)
      .eq("ano_referencia", targetYear)
      .eq("ativo", true);

    if (error) throw error;
    
    // Ensure numeric fields are treated as numbers
    return (data || []).map(d => ({
        ...d,
        valor_mnt_dia: Number(d.valor_mnt_dia),
        valor_acionamento_mensal: Number(d.valor_acionamento_mensal),
    })) as DiretrizClasseIX[];
  };

  return useQuery({
    queryKey: ['diretrizesClasseIX'],
    queryFn: fetchDiretrizes,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// --- Mutation Hook ---
export const useUpdateDiretrizClasseIX = () => {
  const queryClient = useQueryClient();

  const updateDiretrizes = async (items: DiretrizClasseIX[]) => {
    // Usamos upsert com onConflict: 'id' para atualizar registros existentes
    const { error } = await supabase
      .from('diretrizes_classe_ix')
      .upsert(items, { onConflict: 'id' }); 

    if (error) throw error;
  };

  return useMutation({
    mutationFn: updateDiretrizes,
    onSuccess: () => {
      // Invalida o cache para forçar o recarregamento dos dados atualizados
      queryClient.invalidateQueries({ queryKey: ['diretrizesClasseIX'] });
    },
    onError: (error) => {
      console.error("Erro ao salvar diretrizes Classe IX:", error);
      toast.error("Falha ao salvar diretrizes de Classe IX.");
    },
  });
};