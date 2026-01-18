import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";

/**
 * Determina o ano de referência para as diretrizes de Custeio Logístico.
 * Prioriza: Ano Padrão do Perfil > Ano Mais Recente Cadastrado > Ano Atual.
 * 
 * @returns O ano de referência e o ano padrão definido no perfil.
 */
export const useDefaultLogisticaYear = () => {
    const { user } = useSession();
    const currentYear = new Date().getFullYear();

    return useQuery({
        queryKey: ["defaultLogisticaYear", user?.id],
        queryFn: async () => {
            if (!user?.id) {
                return { year: currentYear, defaultYear: null };
            }

            // 1. Buscar o ano padrão de Logística do perfil
            const { data: profileData } = await supabase
                .from('profiles')
                .select('default_logistica_year')
                .eq('id', user.id)
                .maybeSingle();
            
            const defaultYear = profileData?.default_logistica_year || null;

            // 2. Buscar o ano mais recente disponível em diretrizes_custeio
            const { data: latestLogisticaData } = await supabase
                .from("diretrizes_custeio")
                .select("ano_referencia")
                .eq("user_id", user.id)
                .order("ano_referencia", { ascending: false })
                .limit(1)
                .maybeSingle();
                
            const latestLogisticaYear = latestLogisticaData?.ano_referencia || null;
            
            // 3. Determinar o ano a ser usado
            let yearToUse = currentYear;
            
            if (defaultYear && (defaultYear === latestLogisticaYear || defaultYear === currentYear)) {
                yearToUse = defaultYear;
            } else if (latestLogisticaYear) {
                yearToUse = latestLogisticaYear;
            }
            
            return { year: yearToUse, defaultYear };
        },
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 5, // 5 minutos de cache
    });
};