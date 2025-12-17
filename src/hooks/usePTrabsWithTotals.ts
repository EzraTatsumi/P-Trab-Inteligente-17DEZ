import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchPTrabTotals } from "@/components/PTrabCostSummary";
import { Tables } from "@/integrations/supabase/types";

type PTrabRow = Tables<'p_trab'> & {
    totalLogistica?: number;
    totalOperacional?: number;
    totalMaterialPermanente?: number;
    totalAviacaoExercito?: number;
};

const fetchPTrabsWithTotals = async (): Promise<PTrabRow[]> => {
    const { data: ptrabs, error } = await supabase
        .from('p_trab')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;

    if (!ptrabs || ptrabs.length === 0) {
        return [];
    }

    // Para cada PTrab, buscamos e anexamos os totais calculados
    const ptrabsWithTotals = await Promise.all(ptrabs.map(async (ptrab) => {
        try {
            const totals = await fetchPTrabTotals(ptrab.id);
            return {
                ...ptrab,
                totalLogistica: totals.totalLogistica,
                totalOperacional: totals.totalOperacional,
                totalMaterialPermanente: totals.totalMaterialPermanente,
                totalAviacaoExercito: totals.totalAviacaoExercito,
            };
        } catch (e) {
            console.error(`Error calculating totals for PTrab ${ptrab.id}:`, e);
            return {
                ...ptrab,
                totalLogistica: 0,
                totalOperacional: 0,
                totalMaterialPermanente: 0,
                totalAviacaoExercito: 0,
            };
        }
    }));

    return ptrabsWithTotals;
};

export const usePTrabsWithTotals = () => {
    return useQuery<PTrabRow[]>({
        queryKey: ['ptrabsListWithTotals'],
        queryFn: fetchPTrabsWithTotals,
        refetchInterval: 10000,
    });
};