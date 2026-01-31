import { useQuery } from "@tanstack/react-query";
import { fetchPTrabData } from "@/lib/ptrabUtils";
import { PTrabData } from "@/pages/PTrabReportManager";

export const usePTrabData = (ptrabId: string | null) => {
  return useQuery<PTrabData, Error>({
    queryKey: ["ptrabData", ptrabId],
    queryFn: () => {
      if (!ptrabId) throw new Error("PTrab ID is required.");
      return fetchPTrabData(ptrabId);
    },
    enabled: !!ptrabId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};