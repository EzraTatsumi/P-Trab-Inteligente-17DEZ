import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeError } from "@/lib/errorUtils";
import { Tables, TablesUpdate, Json } from "@/integrations/supabase/types";
import { DiretrizMaterialConsumo, ItemAquisicao, ItemAquisicaoTemplate } from "@/types/diretrizesMaterialConsumo";
import { useSession } from '@/components/SessionContextProvider';

// Função de busca de dados
const fetchDiretrizesMaterialConsumo = async (year: number, userId: string): Promise<DiretrizMaterialConsumo[]> => {
    if (!year || !userId) return [];
    
    const { data, error } = await supabase
        .from('diretrizes_material_consumo')
        .select('*')
        .eq('user_id', userId)
        .eq('ano_referencia', year)
        .order('nr_subitem', { ascending: true });
        
    if (error) throw error;
    
    // Mapear o tipo JSONB para ItemAquisicaoTemplate[]
    return (data || []).map(d => ({
        ...d,
        itens_aquisicao: (d.itens_aquisicao as unknown as ItemAquisicaoTemplate[]) || [],
    })) as DiretrizMaterialConsumo[];
};

// Função de persistência para atualização de uma única diretriz
const updateDiretriz = async (diretriz: DiretrizMaterialConsumo) => {
    const { id, user_id, created_at, updated_at, ...updateData } = diretriz;
    
    // Garante que itens_aquisicao é passado como Json
    const dbData: TablesUpdate<'diretrizes_material_consumo'> = {
        ...updateData,
        // O tipo ItemAquisicaoTemplate[] é o que está sendo salvo no DB
        itens_aquisicao: updateData.itens_aquisicao as unknown as Json,
        updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
        .from('diretrizes_material_consumo')
        .update(dbData)
        .eq('id', id);
        
    if (error) throw error;
};

export function useMaterialConsumoDiretrizes(selectedYear: number) {
    const { user } = useSession();
    const userId = user?.id;
    const queryClient = useQueryClient();

    const { data: diretrizes, isLoading, error } = useQuery({
        queryKey: ['diretrizesMaterialConsumo', selectedYear, userId],
        queryFn: () => fetchDiretrizesMaterialConsumo(selectedYear, userId!),
        enabled: !!userId && selectedYear > 0,
        initialData: [],
    });
    
    // Mutação para persistir a movimentação
    const moveMutation = useMutation({
        mutationFn: async ({ sourceDiretriz, targetDiretriz }: { sourceDiretriz: DiretrizMaterialConsumo, targetDiretriz: DiretrizMaterialConsumo }) => {
            // Se a origem e o destino forem o mesmo, não faz nada
            if (sourceDiretriz.id === targetDiretriz.id) return;
            
            // Executa as duas atualizações em paralelo
            await Promise.all([
                updateDiretriz(sourceDiretriz),
                updateDiretriz(targetDiretriz),
            ]);
        },
        onSuccess: () => {
            // Invalida a query para recarregar o estado global
            queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialConsumo', selectedYear, userId] });
            toast.success("Item movido e diretrizes atualizadas com sucesso!");
        },
        onError: (err) => {
            console.error("Erro na mutação de movimentação:", err);
            toast.error(sanitizeError(err) || "Falha ao mover o item. Recarregue a página.");
        }
    });

    /**
     * Lógica principal para mover um ItemAquisicao entre duas diretrizes.
     */
    const handleMoveItem = useCallback((item: ItemAquisicao, sourceDiretrizId: string, targetDiretrizId: string) => {
        if (sourceDiretrizId === targetDiretrizId) return;

        // 1. Clonar o array de diretrizes para manipulação local
        const currentDiretrizes = queryClient.getQueryData<DiretrizMaterialConsumo[]>(['diretrizesMaterialConsumo', selectedYear, userId]) || [];
        
        const sourceDiretriz = currentDiretrizes.find(d => d.id === sourceDiretrizId);
        const targetDiretriz = currentDiretrizes.find(d => d.id === targetDiretrizId);

        if (!sourceDiretriz || !targetDiretriz) {
            toast.error("Diretriz de origem ou destino não encontrada.");
            return;
        }
        
        // 2. Criar cópias mutáveis das diretrizes
        // NOTA: O item que está sendo movido é um ItemAquisicao (completo), mas a diretriz armazena ItemAquisicaoTemplate.
        // Precisamos converter o item de volta para ItemAquisicaoTemplate para inserção/remoção.
        const { quantidade, valor_total, nr_subitem, nome_subitem, ...itemTemplate } = item;
        
        const newSourceDiretriz = { ...sourceDiretriz, itens_aquisicao: [...sourceDiretriz.itens_aquisicao] };
        const newTargetDiretriz = { ...targetDiretriz, itens_aquisicao: [...targetDiretriz.itens_aquisicao] };

        // 3. Remover da origem (usando o ID do template)
        newSourceDiretriz.itens_aquisicao = newSourceDiretriz.itens_aquisicao.filter(i => i.id !== item.id);
        
        // 4. Adicionar ao destino (garantindo que não haja duplicatas pelo ID local)
        if (!newTargetDiretriz.itens_aquisicao.some(i => i.id === item.id)) {
            newTargetDiretriz.itens_aquisicao.push(itemTemplate);
        }

        // 5. Otimisticamente atualizar o cache (melhora a UX)
        const updatedDiretrizes = currentDiretrizes.map(d => {
            if (d.id === sourceDiretrizId) return newSourceDiretriz;
            if (d.id === targetDiretrizId) return newTargetDiretriz;
            return d;
        });
        queryClient.setQueryData(['diretrizesMaterialConsumo', selectedYear, userId], updatedDiretrizes);

        // 6. Persistir a mudança no banco de dados
        moveMutation.mutate({ sourceDiretriz: newSourceDiretriz, targetDiretriz: newTargetDiretriz });

    }, [selectedYear, userId, queryClient, moveMutation]);

    return {
        diretrizes,
        isLoading,
        error,
        handleMoveItem,
        isMoving: moveMutation.isPending,
    };
}