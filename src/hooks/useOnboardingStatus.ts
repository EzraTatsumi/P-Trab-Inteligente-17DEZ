"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCompletedMissions } from "@/lib/missionUtils";
import { useSession } from "@/components/SessionContextProvider";

export const useOnboardingStatus = () => {
  const { user } = useSession();

  return useQuery({
    queryKey: ['activation-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // 1. Verifica Perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // 2. Verifica OMs
      const { count: omCount } = await supabase
        .from('organizacoes_militares')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // 3. Verifica Diretrizes Logísticas
      const { data: logistica } = await supabase
        .from('diretrizes_custeio')
        .select('ano_referencia')
        .eq('user_id', user.id)
        .limit(1);

      // 4. Verifica Diretrizes Operacionais
      const { data: operacional } = await supabase
        .from('diretrizes_operacionais')
        .select('ano_referencia')
        .eq('user_id', user.id)
        .limit(1);

      // 5. Verifica Missões (Todas as 6 concluídas)
      const completedCount = getCompletedMissions(user.id).length;
      const hasMissions = completedCount >= 6;

      const hasOMs = (omCount || 0) > 0;
      const hasLogistica = (logistica?.length || 0) > 0;
      const hasOperacional = (operacional?.length || 0) > 0;

      return {
        hasMissions,
        hasOMs,
        hasLogistica,
        hasOperacional,
        logYear: profile?.default_logistica_year || logistica?.[0]?.ano_referencia,
        opYear: profile?.default_operacional_year || operacional?.[0]?.ano_referencia,
        isReady: hasMissions && hasOMs && hasLogistica && hasOperacional
      };
    },
    enabled: !!user?.id,
    staleTime: 0, // Garante que o dado seja considerado antigo imediatamente
    refetchOnWindowFocus: true, // Atualiza ao voltar para a aba do navegador
    refetchOnMount: true // Atualiza sempre que o componente que usa o hook for montado
  });
};