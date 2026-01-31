import { useQuery } from "@tanstack/react-query";
import { fetchDiretrizesOperacionais } from "@/lib/ptrabUtils";
import { Tables } from "@/integrations/supabase/types";

type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

export const useDiretrizesOperacionais = (year: number | null) => {
  return useQuery<DiretrizOperacional, Error>({
    queryKey: ["diretrizesOperacionais", year],
    queryFn: () => {
      if (!year) throw new Error("Year is required.");
      return fetchDiretrizesOperacionais(year);
    },
    enabled: !!year,
    staleTime: Infinity, // Diretrizes raramente mudam
  });
};