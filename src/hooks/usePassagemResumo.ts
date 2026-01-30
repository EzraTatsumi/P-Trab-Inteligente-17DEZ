import { useQuery } from "@tanstack/react-query";
import { getPassagemResumo } from "@/api/passagem";

export const usePassagemResumo = (ptrabId: string) => {
  return useQuery({
    queryKey: ['passagemResumo', ptrabId],
    queryFn: () => getPassagemResumo(ptrabId),
    enabled: !!ptrabId,
  });
};