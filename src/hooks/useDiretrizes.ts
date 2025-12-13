import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchDiretrizesClasseIX, 
  upsertDiretrizClasseIX, 
  DiretrizClasseIX 
} from '@/integrations/supabase/diretrizes';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// Key for Classe IX directives
const CLASSE_IX_QUERY_KEY = 'diretrizesClasseIX';

interface ClasseIXMutationPayload {
  id?: string;
  ano_referencia: number;
  categoria: string;
  item: string;
  valor_mnt_dia: number;
  valor_acionamento_mensal: number;
  user_id: string;
}

export function useDiretrizesClasseIX(ano: number | undefined) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<DiretrizClasseIX[], Error>({
    queryKey: [CLASSE_IX_QUERY_KEY, ano, userId],
    queryFn: () => {
      if (!ano || !userId) {
        // If data is not ready, return an empty array instead of throwing, 
        // but the query is disabled by 'enabled: !!ano && !!userId'
        return Promise.resolve([]); 
      }
      return fetchDiretrizesClasseIX(ano, userId);
    },
    enabled: !!ano && !!userId,
  });
}

export function useUpsertDiretrizClasseIX() {
  const queryClient = useQueryClient();

  return useMutation<DiretrizClasseIX, Error, ClasseIXMutationPayload>({
    mutationFn: async (payload) => {
      return upsertDiretrizClasseIX(payload);
    },
    onSuccess: (newDiretriz) => {
      // Invalidate the query to refetch the list for the relevant year
      queryClient.invalidateQueries({ queryKey: [CLASSE_IX_QUERY_KEY, newDiretriz.ano_referencia, newDiretriz.user_id] });
      // Optionally show a toast, but keeping it silent for debounced updates
    },
    onError: (error) => {
      toast.error(`Erro ao salvar diretriz Classe IX: ${error.message}`);
    },
  });
}