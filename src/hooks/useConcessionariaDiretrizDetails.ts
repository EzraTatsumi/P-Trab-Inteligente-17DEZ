import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DiretrizConcessionaria } from "@/types/diretrizesConcessionaria";

/**
 * Hook para buscar os detalhes de uma diretriz de concessionária específica.
 * @param diretrizId O ID da diretriz (contrato)
 */
export const useConcessionariaDiretrizDetails = (diretrizId: string | undefined) => {
    return useQuery<DiretrizConcessionaria>({
        queryKey: ['concessionariaDiretrizDetails', diretrizId],
        queryFn: async () => {
            if (!diretrizId) {
                throw new Error("Diretriz ID não fornecido.");
            }
            
            const { data, error } = await supabase
                .from('diretrizes_concessionaria')
                .select('*')
                .eq('id', diretrizId)
                .single();

            if (error) {
                console.error("Erro ao buscar detalhes da diretriz de concessionária:", error);
                throw new Error("Falha ao carregar detalhes da diretriz.");
            }
            
            return data as DiretrizConcessionaria;
        },
        enabled: !!diretrizId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};