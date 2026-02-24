import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";

export const useOnboardingStatus = () => {
  const { user } = useSession();

  return useQuery({
    queryKey: ['onboardingStatus', user?.id],
    queryFn: async () => {
      if (!user) return { isReady: false, completedMissions: [] };

      // Busca o perfil do usuário no Supabase
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // Extrai as missões dos metadados do banco
      const meta = (profile?.raw_user_meta_data as any) || {};
      const dbMissions = meta.missoes_concluidas || [];
      
      // Sincroniza Nuvem -> LocalStorage (para garantir que o progresso persista entre máquinas)
      if (typeof window !== 'undefined') {
        localStorage.setItem('completed_missions', JSON.stringify(dbMissions));
      }

      // Verifica se as diretrizes básicas estão configuradas (Ex: ano padrão definido)
      const hasConfig = !!profile.default_operacional_year || !!profile.default_logistica_year;
      
      return {
        isReady: hasConfig,
        completedMissions: dbMissions,
        totalProgress: Math.round((dbMissions.length / 6) * 100)
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
};