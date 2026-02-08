import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";

/**
 * Determina o ano de referência para as diretrizes de Custos Operacionais.
 * Prioriza: Ano Padrão do Perfil > Ano Mais Recente Cadastrado > Ano Atual.
 * 
 * @returns O ano de referência e o ano padrão definido no perfil.
 */
export const useDefaultDiretrizYear = () => {
    const { user } = useSession();
    const currentYear = new Date().getFullYear();

    return useQuery({
        queryKey: ["defaultOperacionalYear", user?.id],
        queryFn: async () => {
            if (!user?.id) {
                return { year: currentYear, defaultYear: null };
            }

            // 1. Buscar o ano padrão de Operacional do perfil
            const { data: profileData } = await supabase
                .from('profiles')
                .select('default_operacional_year')
                .eq('id', user.id)
                .maybeSingle();
            
            const defaultYear = profileData?.default_operacional_year || null;

            // 2. Buscar o ano mais recente disponível em diretrizes_operacionais
            const { data: latestOperacionalData } = await supabase
                .from("diretrizes_operacionais")
                .select("ano_referencia")
                .eq("user_id", user.id)
                .order("ano_referencia", { ascending: false })
                .limit(1)
                .maybeSingle();
                
            const latestOperacionalYear = latestOperacionalData?.ano_referencia || null;
            
            // 3. Determinar o ano a ser usado
            let yearToUse = currentYear;
            
            // Se o ano padrão estiver definido E for igual ao ano mais recente salvo OU ao ano atual, use-o.
            if (defaultYear && (defaultYear === latestOperacionalYear || defaultYear === currentYear)) {
                yearToUse = defaultYear;
            } else if (latestOperacionalYear) {
                // Se houver um ano salvo mais recente, use-o.
                yearToUse = latestOperacionalYear;
            } else if (defaultYear) {
                // Se houver um ano padrão definido, mas não houver dados salvos, use o padrão.
                yearToUse = defaultYear;
            }
            
            return { year: yearToUse, defaultYear };
        },
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 5, // 5 minutos de cache
    });
};