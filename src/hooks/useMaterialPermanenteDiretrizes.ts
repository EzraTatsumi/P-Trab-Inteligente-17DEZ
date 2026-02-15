import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DiretrizMaterialPermanente } from "@/types/diretrizesMaterialPermanente";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { toast } from "sonner";

export const useMaterialPermanenteDiretrizes = (year: number) => {
    const queryClient = useQueryClient();

    const { data: diretrizes = [], isLoading } = useQuery({
        queryKey: ['diretrizesMaterialPermanente', year],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from('diretrizes_material_permanente' as any)
                .select('*')
                .eq('user_id', user.id)
                .eq('ano_referencia', year)
                .order('nr_subitem', { ascending: true });

            if (error) throw error;
            return data as DiretrizMaterialPermanente[];
        },
        enabled: !!year,
    });

    const moveItemMutation = useMutation({
        mutationFn: async ({ 
            sourceDiretrizId, 
            targetDiretrizId, 
            itemId 
        }: { 
            sourceDiretrizId: string, 
            targetDiretrizId: string, 
            itemId: string 
        }) => {
            const sourceDiretriz = diretrizes.find(d => d.id === sourceDiretrizId);
            const targetDiretriz = diretrizes.find(d => d.id === targetDiretrizId);

            if (!sourceDiretriz || !targetDiretriz) throw new Error("Diretrizes não encontradas");

            const itemToMove = sourceDiretriz.itens_aquisicao.find(i => i.id === itemId);
            if (!itemToMove) throw new Error("Item não encontrado");

            const newSourceItens = sourceDiretriz.itens_aquisicao.filter(i => i.id !== itemId);
            const newTargetItens = [...targetDiretriz.itens_aquisicao, {
                ...itemToMove,
                nr_subitem: targetDiretriz.nr_subitem,
                nome_subitem: targetDiretriz.nome_subitem
            }];

            const { error: errorSource } = await supabase
                .from('diretrizes_material_permanente' as any)
                .update({ itens_aquisicao: newSourceItens })
                .eq('id', sourceDiretrizId);

            if (errorSource) throw errorSource;

            const { error: errorTarget } = await supabase
                .from('diretrizes_material_permanente' as any)
                .update({ itens_aquisicao: newTargetItens })
                .eq('id', targetDiretrizId);

            if (errorTarget) throw errorTarget;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialPermanente', year] });
            toast.success("Item movido com sucesso!");
        },
        onError: (error) => {
            console.error("Erro ao mover item:", error);
            toast.error("Falha ao mover item entre subitens.");
        }
    });

    return {
        diretrizes,
        isLoading,
        handleMoveItem: (sourceId: string, targetId: string, itemId: string) => 
            moveItemMutation.mutate({ sourceDiretrizId: sourceId, targetDiretrizId: targetId, itemId }),
        isMoving: moveItemMutation.isPending
    };
};