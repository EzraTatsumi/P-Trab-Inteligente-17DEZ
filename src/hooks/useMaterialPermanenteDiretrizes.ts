import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DiretrizMaterialPermanente, ItemAquisicaoPermanente } from "@/types/diretrizesMaterialPermanente";
import { toast } from "sonner";

export const useMaterialPermanenteDiretrizes = (year: number) => {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['materialPermanenteDiretrizes', year],
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
            return (data as unknown) as DiretrizMaterialPermanente[];
        }
    });

    const moveItemMutation = useMutation({
        mutationFn: async ({ item, sourceDiretrizId, targetDiretrizId }: { item: ItemAquisicaoPermanente, sourceDiretrizId: string, targetDiretrizId: string }) => {
            // 1. Buscar as duas diretrizes
            const { data: sourceData, error: sourceError } = await supabase.from('diretrizes_material_permanente' as any).select('itens_aquisicao').eq('id', sourceDiretrizId).single();
            const { data: targetData, error: targetError } = await supabase.from('diretrizes_material_permanente' as any).select('itens_aquisicao').eq('id', targetDiretrizId).single();

            if (sourceError || targetError || !sourceData || !targetData) {
                throw new Error("Diretrizes não encontradas ou erro na busca.");
            }

            // Cast explícito para evitar erro de inferência do SelectQueryError
            const typedSourceData = sourceData as any;
            const typedTargetData = targetData as any;

            const sourceItens = (typedSourceData.itens_aquisicao as ItemAquisicaoPermanente[]) || [];
            const targetItens = (typedTargetData.itens_aquisicao as ItemAquisicaoPermanente[]) || [];

            // 2. Remover da origem e adicionar no destino
            const newSourceItens = sourceItens.filter(i => i.id !== item.id);
            const newTargetItens = [...targetItens, { ...item, nr_subitem: '', nome_subitem: '' }];

            // 3. Atualizar no banco
            const { error: updateSourceError } = await supabase.from('diretrizes_material_permanente' as any).update({ itens_aquisicao: newSourceItens }).eq('id', sourceDiretrizId);
            const { error: updateTargetError } = await supabase.from('diretrizes_material_permanente' as any).update({ itens_aquisicao: newTargetItens }).eq('id', targetDiretrizId);
            
            if (updateSourceError || updateTargetError) {
                throw new Error("Falha ao atualizar as diretrizes no banco de dados.");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materialPermanenteDiretrizes', year] });
            toast.success("Item movido com sucesso!");
        },
        onError: (error: any) => {
            toast.error("Erro ao mover item: " + error.message);
        }
    });

    return {
        diretrizes: query.data || [],
        isLoading: query.isLoading,
        isMoving: moveItemMutation.isPending,
        handleMoveItem: (item: ItemAquisicaoPermanente, sourceId: string, targetId: string) => 
            moveItemMutation.mutate({ item, sourceDiretrizId: sourceId, targetDiretrizId: targetId })
    };
};