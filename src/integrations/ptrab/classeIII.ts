import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { sanitizeError } from "@/lib/errorUtils";

// Define the base type for Classe III records
type ClasseIII = Tables<'classe_iii_registros'>;
type ClasseIIIInsert = TablesInsert<'classe_iii_registros'>;
type ClasseIIIUpdate = TablesUpdate<'classe_iii_registros'>;

const CLASSE_III_QUERY_KEY = 'classeIII';

// --- Fetch Hook ---
export const useFetchClasseIII = (ptrabId: string) => {
  return useQuery<ClasseIII[], Error>({
    queryKey: [CLASSE_III_QUERY_KEY, ptrabId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classe_iii_registros')
        .select('*')
        .eq('p_trab_id', ptrabId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ClasseIII[];
    },
    enabled: !!ptrabId,
  });
};

// --- Create Hook ---
export const useCreateClasseIII = () => {
  return useMutation<ClasseIII, Error, ClasseIIIInsert>({
    mutationFn: async (newRegistro) => {
      const { data, error } = await supabase
        .from('classe_iii_registros')
        .insert(newRegistro)
        .select()
        .single();

      if (error) throw error;
      return data as ClasseIII;
    },
    onError: (error) => {
      toast.error(sanitizeError(error));
    }
  });
};

// --- Update Hook ---
export const useUpdateClasseIII = () => {
  return useMutation<ClasseIII, Error, ClasseIIIUpdate & { id: string }>({
    mutationFn: async (updatedRegistro) => {
      const { id, ...updateData } = updatedRegistro;
      const { data, error } = await supabase
        .from('classe_iii_registros')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ClasseIII;
    },
    onError: (error) => {
      toast.error(sanitizeError(error));
    }
  });
};

// --- Delete Hook ---
export const useDeleteClasseIII = () => {
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('classe_iii_registros')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onError: (error) => {
      toast.error(sanitizeError(error));
    }
  });
};