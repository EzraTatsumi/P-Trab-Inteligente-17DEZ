import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OMData } from "@/lib/omUtils";

/**
 * Hook para buscar todas as Organizações Militares (OMs) ativas cadastradas pelo usuário ou padrão.
 * @returns {OMData[] | undefined} Lista de OMs.
 */
export const useMilitaryOrganizations = () => {
  return useQuery<OMData[]>({
    queryKey: ['militaryOrganizations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Busca OMs cadastradas pelo usuário (user_id IS NOT NULL) ou OMs padrão (user_id IS NULL)
      const { data, error } = await supabase
        .from('organizacoes_militares')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .eq('ativo', true)
        .order('nome_om', { ascending: true });

      if (error) {
        console.error("Error fetching military organizations:", error);
        throw new Error("Falha ao carregar Organizações Militares.");
      }

      return data as OMData[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};