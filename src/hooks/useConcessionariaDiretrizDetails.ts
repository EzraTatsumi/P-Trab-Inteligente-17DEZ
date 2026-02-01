import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type DiretrizConcessionariaDetails = Pick<Tables<'diretrizes_concessionaria'>, 'nome_concessionaria' | 'fonte_consumo' | 'fonte_custo'>;

const fetchConcessionariaDiretrizDetails = async (diretrizId: string): Promise<DiretrizConcessionariaDetails | null> => {
    if (!diretrizId) return null;

    const { data, error } = await supabase
        .from('diretrizes_concessionaria')
        .select('nome_concessionaria, fonte_consumo, fonte_custo')
        .eq('id', diretrizId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching concessionaria diretriz details:", error);
        throw error;
    }

    return data as DiretrizConcessionariaDetails | null;
};

export const useConcessionariaDiretrizDetails = (diretrizId: string | undefined) => {
    return useQuery<DiretrizConcessionariaDetails | null>({
        queryKey: ['concessionariaDiretrizDetails', diretrizId],
        queryFn: () => fetchConcessionariaDiretrizDetails(diretrizId!),
        enabled: !!diretrizId,
    });
};