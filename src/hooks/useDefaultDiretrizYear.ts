import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/components/SessionContextProvider';
import { fetchDefaultLogisticaYear, fetchDefaultOperacionalYear } from '@/lib/ptrabUtils';

type DiretrizType = 'logistica' | 'operacional';

/**
 * Hook para buscar o ano de referência padrão do usuário (logística ou operacional).
 * @param type O tipo de diretriz a buscar ('logistica' ou 'operacional'). Opcional, padroniza para 'logistica'.
 * @returns O ano padrão e o ano atual (fallback).
 */
export function useDefaultDiretrizYear(type: DiretrizType = 'logistica') {
    const { user } = useSession();
    const userId = user?.id;
    const currentYear = new Date().getFullYear();

    const queryKey = ['defaultDiretrizYear', userId, type];

    const { data, isLoading, error } = useQuery({
        queryKey: queryKey,
        queryFn: async () => {
            if (!userId) return { defaultYear: null, year: currentYear };

            const fetchFunction = type === 'logistica' 
                ? fetchDefaultLogisticaYear 
                : fetchDefaultOperacionalYear;
            
            const defaultYear = await fetchFunction();
            
            // Se o ano padrão não estiver definido ou for inválido, usa o ano atual como fallback
            const year = defaultYear && defaultYear > 0 ? defaultYear : currentYear;
            
            return { defaultYear, year };
        },
        enabled: !!userId,
        initialData: { defaultYear: null, year: currentYear },
    });

    return {
        data,
        isLoading,
        error,
    };
}