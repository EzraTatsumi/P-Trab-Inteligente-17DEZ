import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DiretrizEquipamentoClasse3 } from "@/types/diretrizesEquipamentos";
import { toast } from "sonner";

/**
 * Fetches the user's default diretriz year from the profile.
 */
const fetchDefaultDiretrizYear = async (userId: string): Promise<number> => {
  const currentYear = new Date().getFullYear();
  if (!userId) return currentYear;

  const { data, error } = await supabase
    .from('profiles')
    .select('default_diretriz_year')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching default year:", error);
    // Fallback to current year on error
    return currentYear;
  }

  return data?.default_diretriz_year || currentYear;
};

/**
 * Fetches Classe III equipment directives (consumptions) for the user's default year.
 */
export const useFetchDiretrizesEquipamentos = (userId: string | undefined) => {
  const currentYear = new Date().getFullYear();
  
  // 1. Query to get the default year
  const { data: defaultYear, isLoading: isLoadingYear } = useQuery<number, Error>({
    queryKey: ['defaultDiretrizYear', userId],
    queryFn: () => fetchDefaultDiretrizYear(userId!),
    enabled: !!userId,
    initialData: currentYear,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // 2. Query to fetch the directives using the determined year
  return useQuery<DiretrizEquipamentoClasse3[], Error>({
    queryKey: ['diretrizesEquipamentos', userId, defaultYear],
    queryFn: async () => {
      if (!userId || !defaultYear) return [];

      const { data, error } = await supabase
        .from('diretrizes_equipamentos_classe_iii')
        .select('*')
        .eq('user_id', userId)
        .eq('ano_referencia', defaultYear)
        .eq('ativo', true)
        .order('nome_equipamento', { ascending: true });

      if (error) {
        console.error("Error fetching Classe III directives:", error);
        toast.error("Falha ao carregar diretrizes de equipamentos.");
        return [];
      }
      
      // Ensure consumption is treated as number
      return (data || []).map(d => ({
          ...d,
          consumo: Number(d.consumo),
      })) as DiretrizEquipamentoClasse3[];
    },
    enabled: !!userId && !isLoadingYear,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};