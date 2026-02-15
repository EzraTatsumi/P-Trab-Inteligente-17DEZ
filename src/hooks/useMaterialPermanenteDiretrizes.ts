import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DiretrizMaterialPermanente } from "@/types/diretrizesMaterialPermanente";

export const useMaterialPermanenteDiretrizes = (year: number, userId?: string) => {
    return useQuery({
        queryKey: ['materialPermanenteDiretrizes', year, userId],
        queryFn: async () => {
            if (!userId) return [];
            
            const { data, error } = await supabase
                .from('diretrizes_material_permanente' as any)
                .select('*')
                .eq('user_id', userId)
                .eq('ano_referencia', year)
                .order('nr_subitem', { ascending: true });

            if (error) throw error;
            
            // Convertendo para unknown primeiro para evitar erro de sobreposição de tipos do compilador
            return (data as unknown) as DiretrizMaterialPermanente[];
        },
        enabled: !!userId,
    });
};