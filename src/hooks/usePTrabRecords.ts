import { useQuery } from "@tanstack/react-query";
import { fetchPTrabRecords, PTrabLinkedTableName } from "@/lib/ptrabUtils";
import { Tables } from "@/integrations/supabase/types";

export const usePTrabRecords = <T extends PTrabLinkedTableName>(tableName: T, ptrabId: string | null) => {
  return useQuery<Tables<T>[], Error>({
    queryKey: [tableName, ptrabId],
    queryFn: () => {
      if (!ptrabId) throw new Error("PTrab ID is required.");
      return fetchPTrabRecords(tableName, ptrabId);
    },
    enabled: !!ptrabId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};