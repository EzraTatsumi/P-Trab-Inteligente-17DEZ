"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { fetchBatchPTrabTotals } from "@/lib/ptrabUtils";
import { TOTAL_MISSIONS } from "@/lib/missionUtils";

export const useOnboardingStatus = () => {
  const { user } = useSession();

  return useQuery({
    queryKey: ["onboardingStatus", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // 1. Busca missões no Supabase
      const { data: missions } = await supabase
        .from("user_missions")
        .select("mission_id")
        .eq("user_id", user.id);

      // 2. Busca OMs
      const { data: oms } = await supabase
        .from("organizacoes_militares")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      // 3. Busca Perfil (Anos Padrão)
      const { data: profile } = await supabase
        .from("profiles")
        .select("default_logistica_year, default_operacional_year")
        .eq("id", user.id)
        .single();

      // 4. Verifica se existem diretrizes para os anos padrão
      let hasLogistica = false;
      let hasOperacional = false;

      if (profile?.default_logistica_year) {
        const { count: logCount } = await supabase
          .from("diretrizes_custeio")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("ano_referencia", profile.default_logistica_year);
        hasLogistica = (logCount || 0) > 0;
      }

      if (profile?.default_operacional_year) {
        const { count: opCount } = await supabase
          .from("diretrizes_operacionais")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("ano_referencia", profile.default_operacional_year);
        hasOperacional = (opCount || 0) > 0;
      }

      const completedMissionsCount = new Set((missions || []).map(m => m.mission_id)).size;
      const hasMissions = completedMissionsCount >= TOTAL_MISSIONS;
      const hasOMs = (oms?.length || 0) > 0;

      return {
        hasMissions,
        hasOMs,
        hasLogistica,
        hasOperacional,
        logYear: profile?.default_logistica_year,
        opYear: profile?.default_operacional_year,
        isReady: hasMissions && hasOMs && hasLogistica && hasOperacional,
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
};