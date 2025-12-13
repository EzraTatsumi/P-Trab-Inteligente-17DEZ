import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { updateDiretrizClasseIX, DiretrizClasseIXUpdate } from "@/services/diretrizesService";

export interface DiretrizClasseIX {
  id: string;
  ano_referencia: number;
  categoria: string;
  item: string;
  valor_mnt_dia: number;
  valor_acionamento_mensal: number;
  ativo: boolean;
}

const CLASSE_IX_QUERY_KEY = 'diretrizes_classe_ix';

async function fetchDiretrizesClasseIX(ano: number): Promise<DiretrizClasseIX[]> {
  const { data, error } = await supabase
    .from('diretrizes_classe_ix')
    .select('*')
    .eq('ano_referencia', ano)
    .order('item', { ascending: true });

  if (error) {
    console.error("Error fetching Classe IX directives:", error);
    throw new Error("Falha ao carregar diretrizes da Classe IX.");
  }
  return data as DiretrizClasseIX[];
}

export function useDiretrizesClasseIX(ano: number) {
  const queryClient = useQueryClient();

  const { data: diretrizes, isLoading, error } = useQuery<DiretrizClasseIX[]>({
    queryKey: [CLASSE_IX_QUERY_KEY, ano],
    queryFn: () => fetchDiretrizesClasseIX(ano),
    enabled: !!ano,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: DiretrizClasseIXUpdate[]) => {
      // Assuming we handle multiple updates in a transaction or sequentially.
      return Promise.all(updates.map(updateDiretrizClasseIX));
    },
    onSuccess: () => {
      toast.success("Diretrizes da Classe IX salvas com sucesso!");
      // Invalidate the query to refetch the updated data
      queryClient.invalidateQueries({ queryKey: [CLASSE_IX_QUERY_KEY, ano] });
    },
    onError: (err) => {
      console.error("Failed to save Classe IX directives:", err);
      toast.error("Erro ao salvar diretrizes da Classe IX.");
    },
  });

  return {
    diretrizes: diretrizes || [],
    isLoading,
    error,
    updateMutation,
  };
}