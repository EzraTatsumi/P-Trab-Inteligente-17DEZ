import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";

type ClasseIIIRegistro = Tables<'classe_iii_registros'>;
type ClasseIIIRegistroInsert = TablesInsert<'classe_iii_registros'>;

/**
 * Fetches all Classe III records for a specific PTrab.
 */
export const useFetchClasseIII = (pTrabId: string) => {
  return useQuery<ClasseIIIRegistro[], Error>({
    queryKey: ['classeIII', pTrabId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classe_iii_registros')
        .select('*')
        .eq('p_trab_id', pTrabId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("Error fetching Classe III records:", error);
        throw new Error("Falha ao carregar registros da Classe III.");
      }
      return data as ClasseIIIRegistro[];
    },
    enabled: !!pTrabId,
  });
};

/**
 * Mutates (replaces) all Classe III records for a specific PTrab.
 * This pattern deletes all existing records and inserts the new list.
 */
export const useMutateClasseIII = (pTrabId: string) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ClasseIIIRegistroInsert[]>({
    mutationFn: async (newRecords) => {
      // 1. Delete all existing records for this PTrab
      const { error: deleteError } = await supabase
        .from('classe_iii_registros')
        .delete()
        .eq('p_trab_id', pTrabId);

      if (deleteError) {
        console.error("Error deleting old Classe III records:", deleteError);
        throw new Error("Falha ao limpar registros antigos.");
      }

      // 2. Prepare records for insertion (ensure p_trab_id is set)
      const recordsToInsert = newRecords.map(record => ({
        ...record,
        p_trab_id: pTrabId,
        // Ensure numeric fields are not null if they are required by the DB schema
        quantidade: record.quantidade || 0,
        dias_operacao: record.dias_operacao || 0,
        preco_litro: record.preco_litro || 0,
        total_litros: record.total_litros || 0,
        valor_total: record.valor_total || 0,
        valor_nd_30: record.valor_nd_30 || 0,
        valor_nd_39: record.valor_nd_39 || 0,
      }));

      // 3. Insert new records
      if (recordsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('classe_iii_registros')
          .insert(recordsToInsert as TablesInsert<'classe_iii_registros'>[]);

        if (insertError) {
          console.error("Error inserting new Classe III records:", insertError);
          throw new Error("Falha ao inserir novos registros.");
        }
      }
      
      // 4. Update PTrab status if currently 'aberto'
      await updatePTrabStatusIfAberto(pTrabId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ptrabTotals', pTrabId] });
      queryClient.invalidateQueries({ queryKey: ['classeIII', pTrabId] });
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
};