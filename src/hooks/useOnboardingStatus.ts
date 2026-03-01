import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";

export interface OnboardingStatus {
  hasOMs: boolean;
  hasLogistica: boolean;
  hasOperacional: boolean;
  hasMissions: boolean;
  isReady: boolean;
}

export const useOnboardingStatus = () => {
  const { user } = useSession();

  return useQuery({
    queryKey: ['user-status', user?.id],
    queryFn: async (): Promise<OnboardingStatus> => {
      if (!user?.id) return { hasOMs: false, hasLogistica: false, hasOperacional: false, hasMissions: false, isReady: false };

      // Mantendo a queryFn original para contagem no banco
      const [oms, log, op, missions] = await Promise.all([
        supabase.from('organizacoes_militares').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('diretrizes_custeio').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('diretrizes_operacionais').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('user_missions' as any).select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      ]);

      const hasOMs = (oms.count || 0) > 0;
      const hasLogistica = (log.count || 0) > 0;
      const hasOperacional = (op.count || 0) > 0;
      const hasMissions = (missions.count || 0) === 6; // Verificação exata de 6 missões para liberar o sistema

      return {
        hasOMs,
        hasLogistica,
        hasOperacional,
        hasMissions,
        // CORREÇÃO: Agora exige as missões para liberar o sistema
        isReady: hasOMs && hasLogistica && hasOperacional && hasMissions
      };
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 1000, // Sincronismo em tempo real (1 segundo)
  });
};