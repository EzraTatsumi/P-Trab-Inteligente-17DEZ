import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PTrabData } from "@/pages/PTrabReportManager"; // Reutilizando o tipo PTrabData

/**
 * Fetches the main PTrab data by ID.
 * @param pTrabId The ID of the PTrab.
 * @returns Query result containing PTrabData.
 */
export const usePTrab = (pTrabId: string | undefined) => {
  return useQuery({
    queryKey: ["ptrab", pTrabId],
    queryFn: async () => {
      if (!pTrabId) return null;

      const { data, error } = await supabase
        .from("p_trab")
        .select("*, ref_lpc:p_trab_ref_lpc(*)")
        .eq("id", pTrabId)
        .single();

      if (error) throw error;
      
      // O tipo PTrabData é usado para relatórios e inclui campos como ref_lpc
      return data as PTrabData & { ref_lpc: { preco_diesel: number, preco_gasolina: number } | null };
    },
    enabled: !!pTrabId,
  });
};