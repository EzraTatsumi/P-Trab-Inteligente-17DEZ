import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";

/**
 * Determina o ano de referência para as diretrizes de custeio/operacionais.
 * Prioriza: Ano Padrão do Perfil > Ano Mais Recente Cadastrado > Ano Atual.
 * 
 * @returns O ano de referência e o ano padrão definido no perfil.
 */
export const useDefaultDiretrizYear = () => {
    const { user } = useSession();
    const currentYear = new Date().getFullYear();

    return useQuery({
        queryKey: ["defaultDiretrizYear", user?.id],
        queryFn: async () => {
            if (!user?.id) {
                return { year: currentYear, defaultYear: null };
            }

            // 1. Buscar o ano padrão do perfil
            const { data: profileData } = await supabase
                .from('profiles')
                .select('default_diretriz_year')
                .eq('id', user.id)
                .maybeSingle();
            
            const defaultYear = profileData?.default_diretriz_year || null;

            // 2. Buscar o ano mais recente disponível em diretrizes_operacionais
            const { data: latestOpData } = await supabase
                .from("diretrizes_operacionais")
                .select("ano_referencia")
                .eq("user_id", user.id)
                .order("ano_referencia", { ascending: false })
                .limit(1)
                .maybeSingle();
                
            const latestOpYear = latestOpData?.ano_referencia || null;
            
            // 3. Determinar o ano a ser usado
            let yearToUse = currentYear;
            
            if (defaultYear && (defaultYear === latestOpYear || defaultYear === currentYear)) {
                yearToUse = defaultYear;
            } else if (latestOpYear) {
                yearToUse = latestOpYear;
            }
            
            return { year: yearToUse, defaultYear };
        },
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 5, // 5 minutos de cache
    });
};