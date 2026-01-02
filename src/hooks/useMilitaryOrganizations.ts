import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OMData } from "@/lib/omUtils";
import { toast } from "sonner";

const fetchMilitaryOrganizations = async (): Promise<OMData[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Retorna array vazio se não houver usuário logado
    return [];
  }

  const { data, error } = await supabase
    .from("organizacoes_militares")
    .select("*")
    .eq("user_id", user.id)
    .order("nome_om", { ascending: true });

  if (error) {
    console.error("Erro ao buscar OMs:", error);
    throw new Error("Falha ao carregar Organizações Militares.");
  }

  return data as OMData[];
};

export const useMilitaryOrganizations = () => {
  return useQuery({
    queryKey: ["militaryOrganizations"],
    queryFn: fetchMilitaryOrganizations,
    staleTime: 1000 * 60 * 5, // 5 minutes
    onError: (error) => {
      toast.error(error.message);
    }
  });
};