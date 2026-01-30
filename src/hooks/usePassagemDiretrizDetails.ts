import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { sanitizeError } from "@/lib/errorUtils";

type DiretrizPassagem = Tables<'diretrizes_passagens'>;

const fetchDiretrizDetails = async (diretrizId: string): Promise<DiretrizPassagem | null> => {
    if (!diretrizId) return null;

    const { data, error } = await supabase
        .from('diretrizes_passagens')
        .select('numero_pregao, ug_referencia')
        .eq('id', diretrizId)
        .single();

    if (error) {
        console.error("Erro ao buscar detalhes da diretriz de passagem:", error);
        throw new Error(sanitizeError(error));
    }

    return data;
};

export const usePassagemDiretrizDetails = (diretrizId: string | undefined) => {
    return useQuery<DiretrizPassagem | null>({
        queryKey: ['diretrizPassagemDetails', diretrizId],
        queryFn: () => fetchDiretrizDetails(diretrizId!),
        enabled: !!diretrizId,
        staleTime: 1000 * 60 * 5, // 5 minutos
    });
};