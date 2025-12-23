import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useSession } from "@/components/SessionContextProvider";

type DiretrizEquipamento = Tables<'diretrizes_equipamentos_classe_iii'>;

// --- Fetch Hook for Classe III Equipment Directives ---
export const useFetchDiretrizesEquipamentos = () => {
  const { user } = useSession();
  
  return useQuery<DiretrizEquipamento[], Error>({
    queryKey: ['diretrizesEquipamentos'],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Fetch the user's default year from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('default_diretriz_year')
        .eq('id', user.id)
        .maybeSingle();
        
      const year = profile?.default_diretriz_year || new Date().getFullYear();

      const { data, error } = await supabase
        .from('diretrizes_equipamentos_classe_iii')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano_referencia', year)
        .eq('ativo', true);

      if (error) {
        console.error("Error fetching equipment directives:", error);
        toast.error("Erro ao carregar diretrizes de equipamentos.");
        throw error;
      }
      return data as DiretrizEquipamento[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};