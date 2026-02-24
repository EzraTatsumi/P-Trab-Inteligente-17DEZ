"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";

export const useOnboardingStatus = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  // Escuta o evento de missão concluída para atualizar o checklist na hora
  useEffect(() => {
    const handleMissionUpdate = (event: any) => {
      if (event.detail?.userId === user?.id) {
        queryClient.invalidateQueries({ queryKey: ["onboarding-status", user?.id] });
      }
    };

    window.addEventListener('mission:completed', handleMissionUpdate);
    return () => window.removeEventListener('mission:completed', handleMissionUpdate);
  }, [queryClient, user?.id]);

  return useQuery({
    queryKey: ["onboarding-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // 1. Verifica Missões (Centro de Instrução)
      const completedMissions = JSON.parse(localStorage.getItem(`completed_missions_${user.id}`) || '[]');
      // Consideramos apto quem fez as 3 principais ou explorou o sistema
      const hasMissions = completedMissions.length >= 3;

      // 2. Verifica OMs
      const { count: omCount } = await supabase
        .from("organizacoes_militares")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // 3. Verifica Diretrizes Logísticas e Operacionais
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
    staleTime: 1000 * 30, // 30 segundos
  });
};