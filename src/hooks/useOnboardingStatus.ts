import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";

export const useOnboardingStatus = () => {
  const { user } = useSession();

  return useQuery({
    queryKey: ['onboardingStatus', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // 1. Busca os anos padrão no perfil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('default_logistica_year, default_operacional_year')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // 2. Busca dados em paralelo para verificar existência
      const [oms, logData, opData] = await Promise.all([
        // Verifica se existe pelo menos uma OM
        supabase.from('organizacoes_militares').select('id', { count: 'exact', head: true }),
        
        // Verifica diretrizes de custeio (Logística) para o ano padrão
        profile?.default_logistica_year 
          ? supabase.from('diretrizes_custeio').select('id').eq('ano_referencia', profile.default_logistica_year).maybeSingle()
          : Promise.resolve({ data: null }),
          
        // Verifica diretrizes operacionais para o ano padrão
        profile?.default_operacional_year
          ? supabase.from('diretrizes_operacionais').select('id').eq('ano_referencia', profile.default_operacional_year).maybeSingle()
          : Promise.resolve({ data: null })
      ]);

      return {
        hasOMs: (oms.count ?? 0) > 0,
        hasLogistica: !!logData.data,
        hasOperacional: !!opData.data,
        logYear: profile?.default_logistica_year,
        opYear: profile?.default_operacional_year,
        // Só está pronto se houver OMs E ambas as diretrizes nos anos padrão
        isReady: (oms.count ?? 0) > 0 && !!logData.data && !!opData.data
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutos de cache
  });
};