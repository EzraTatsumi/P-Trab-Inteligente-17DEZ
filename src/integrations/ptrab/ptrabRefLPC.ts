import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type RefLPC = Tables<'p_trab_ref_lpc'>;

// --- Fetch Hook for PTrab Ref LPC ---
export const useFetchPTrabRefLPC = (ptrabId: string) => {
  return useQuery<RefLPC | null, Error>({
    queryKey: ['ptrabRefLPC', ptrabId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('p_trab_ref_lpc')
        .select('*')
        .eq('p_trab_id', ptrabId)
        .maybeSingle();

      if (error) throw error;
      return data as RefLPC | null;
    },
    enabled: !!ptrabId,
    staleTime: Infinity, // LPC usually doesn't change unless updated manually
  });
};