"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";

export const useOnboardingStatus = () => {
  const { user } = useSession();

  return useQuery({
    queryKey: ["onboarding-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // 1. Verifica Missões (Centro de Instrução)
      // Consideramos concluído se o usuário completou pelo menos as 3 missões principais
      const completedMissions = JSON.parse(localStorage.getItem(`completed_missions_${user.id}`) || '[]');
      const hasMissions = completedMissions.length >= 3;

      // 2. Verifica OMs
      const { count: omCount } = await supabase
        .from("organizacoes_militares")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // 3. Verifica Diretrizes Logísticas (Ano Padrão)
      const { data: profile } = await supabase
        .from("profiles")
        .select("default_logistica_year, default_operacional_year")
        .eq("id", user.id)
        .single();

      const hasLogistica = !!profile?.default_logistica_year;
      const hasOperacional = !!profile?.default_operacional_year;

      return {
        hasMissions,
        hasOMs: (omCount || 0) > 0,
        hasLogistica,
        hasOperacional,
        logYear: profile?.default_logistica_year,
        opYear: profile?.default_operacional_year,
        isReady: hasMissions && (omCount || 0) > 0 && hasLogistica && hasOperacional,
      };
    },
    enabled: !!user?.id,
  });
};