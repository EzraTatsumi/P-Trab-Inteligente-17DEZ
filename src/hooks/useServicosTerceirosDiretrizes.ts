import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DiretrizServicoTerceiro, ItemServico } from "@/types/diretrizesServicosTerceiros";
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

/**
 * Hook para gerenciar as diretrizes de Serviços de Terceiros (ND 33.90.39).
 * @param year Ano de referência para as diretrizes.
 */
export function useServicosTerceirosDiretrizes(year: number) {
  const queryClient = useQueryClient();

  // 1. Busca as diretrizes do ano selecionado
  const { data: diretrizes = [], isLoading } = useQuery({
    queryKey: ["diretrizesServicosTerceiros", year],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("diretrizes_servicos_terceiros")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", year)
        .order("nr_subitem", { ascending: true });

      if (error) {
        console.error("Erro ao buscar diretrizes de serviços:", error);
        throw error;
      }

      // Converte o campo JSONB para o tipo tipado ItemServico[]
      return (data || []).map(d => ({
        ...d,
        itens_aquisicao: (d.itens_aquisicao as unknown as ItemServico[]) || []
      })) as DiretrizServicoTerceiro[];
    },
    enabled: !!year,
  });

  // 2. Mutação para Salvar (Criar ou Atualizar)
  const saveMutation = useMutation({
    mutationFn: async (payload: { 
      id?: string; 
      nr_subitem: string; 
      nome_subitem: string; 
      descricao_subitem?: string; 
      itens_aquisicao: ItemServico[];
      ativo?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { id, ...rest } = payload;
      
      if (id) {
        // Update
        const { error } = await supabase
          .from("diretrizes_servicos_terceiros")
          .update({
            ...rest,
            itens_aquisicao: rest.itens_aquisicao as any,
            updated_at: new Date().toISOString(),
          } as TablesUpdate<'diretrizes_servicos_terceiros'>)
          .eq("id", id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("diretrizes_servicos_terceiros")
          .insert([{
            ...rest,
            user_id: user.id,
            ano_referencia: year,
            itens_aquisicao: rest.itens_aquisicao as any,
            ativo: rest.ativo ?? true,
          } as TablesInsert<'diretrizes_servicos_terceiros'>]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diretrizesServicosTerceiros", year] });
      toast.success("Diretriz de serviços salva com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar diretriz: " + error.message);
    }
  });

  // 3. Mutação para Excluir
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("diretrizes_servicos_terceiros")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diretrizesServicosTerceiros", year] });
      toast.success("Diretriz excluída com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir diretriz: " + error.message);
    }
  });

  // 4. Mutação para Alternar Status (Ativo/Inativo)
  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("diretrizes_servicos_terceiros")
        .update({ ativo } as TablesUpdate<'diretrizes_servicos_terceiros'>)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diretrizesServicosTerceiros", year] });
    },
    onError: (error) => {
      toast.error("Erro ao alterar status: " + error.message);
    }
  });

  return {
    diretrizes,
    isLoading,
    saveDiretriz: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    deleteDiretriz: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    toggleAtivo: toggleAtivoMutation.mutateAsync,
  };
}