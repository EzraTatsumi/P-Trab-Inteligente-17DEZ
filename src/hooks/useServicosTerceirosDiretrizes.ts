import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DiretrizServicosTerceiros, ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export const useServicosTerceirosDiretrizes = (year: number) => {
    const queryClient = useQueryClient();

    const { data: diretrizes = [], isLoading } = useQuery({
        queryKey: ['diretrizesServicosTerceiros', year],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from('diretrizes_servicos_terceiros')
                .select('*')
                .eq('user_id', user.id)
                .eq('ano_referencia', year)
                .order('nr_subitem', { ascending: true });

            if (error) throw error;

            return (data || []).map(d => ({
                ...d,
                itens_aquisicao: (d.itens_aquisicao as unknown as ItemAquisicaoServico[]) || []
            })) as DiretrizServicosTerceiros[];
        },
        enabled: !!year
    });

    const moveItemMutation = useMutation({
        mutationFn: async ({ item, sourceId, targetId }: { item: ItemAquisicaoServico, sourceId: string, targetId: string }) => {
            const sourceDiretriz = diretrizes.find(d => d.id === sourceId);
            const targetDiretriz = diretrizes.find(d => d.id === targetId);

            if (!sourceDiretriz || !targetDiretriz) throw new Error("Diretriz não encontrada");

            const newSourceItens = sourceDiretriz.itens_aquisicao.filter(i => i.id !== item.id);
            const newTargetItens = [...targetDiretriz.itens_aquisicao, item];

            const { error: errorSource } = await supabase
                .from('diretrizes_servicos_terceiros')
                .update({ itens_aquisicao: newSourceItens as unknown as Json })
                .eq('id', sourceId);

            if (errorSource) throw errorSource;

            const { error: errorTarget } = await supabase
                .from('diretrizes_servicos_terceiros')
                .update({ itens_aquisicao: newTargetItens as unknown as Json })
                .eq('id', targetId);

            if (errorTarget) throw errorTarget;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diretrizesServicosTerceiros', year] });
            toast.success("Item movido com sucesso!");
        },
        onError: (error) => {
            console.error("Erro ao mover item:", error);
            toast.error("Erro ao mover item entre subitens.");
        }
    });

    return {
        diretrizes,
        isLoading,
        handleMoveItem: (item: ItemAquisicaoServico, sourceId: string, targetId: string) => 
            moveItemMutation.mutate({ item, sourceId, targetId }),
        isMoving: moveItemMutation.isPending
    };
};