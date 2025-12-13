import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './client';
import { toast } from 'sonner';

// Tipagem básica para a diretriz da Classe IX
export type DiretrizClasseIX = {
  id: string;
  user_id: string;
  ano_referencia: number;
  categoria: string;
  item: string;
  valor_mnt_dia: number;
  valor_acionamento_mensal: number;
  ativo: boolean;
};

// Query Key
const CLASSE_IX_QUERY_KEY = (ano: number) => ['diretrizes', 'classe_ix', ano];

// 1. Fetch Hook
export const useFetchDiretrizesClasseIX = (ano: number) => {
  return useQuery<DiretrizClasseIX[], Error>({
    queryKey: CLASSE_IX_QUERY_KEY(ano),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diretrizes_classe_ix')
        .select('*')
        .eq('ano_referencia', ano)
        .order('item', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }
      return data || [];
    },
    enabled: !!ano,
  });
};

// 2. Mutation Hook
export const useUpdateDiretrizClasseIX = (ano: number) => {
  const queryClient = useQueryClient();

  return useMutation<DiretrizClasseIX, Error, Partial<DiretrizClasseIX>>({
    mutationFn: async (updateData) => {
      if (!updateData.id) {
        throw new Error("ID da diretriz é obrigatório para atualização.");
      }
      
      const { data, error } = await supabase
        .from('diretrizes_classe_ix')
        .update(updateData)
        .eq('id', updateData.id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => {
      // AQUI ESTÁ A CORREÇÃO: Invalida o cache da lista de diretrizes da Classe IX
      queryClient.invalidateQueries({ queryKey: CLASSE_IX_QUERY_KEY(ano) });
      toast.success('Diretriz da Classe IX atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar diretriz da Classe IX: ${error.message}`);
    },
  });
};