import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MilitaryOrganization {
  id: string;
  nome_om: string;
  codug_om: string;
  rm_vinculacao: string;
  codug_rm_vinculacao: string;
}

const fetchMilitaryOrganizations = async (): Promise<MilitaryOrganization[]> => {
  const { data, error } = await supabase
    .from("organizacoes_militares")
    .select("id, nome_om, codug_om, rm_vinculacao, codug_rm_vinculacao")
    .eq("ativo", true)
    .order("nome_om", { ascending: true });

  if (error) {
    console.error("Error fetching military organizations:", error);
    toast.error("Erro ao carregar a lista de Organizações Militares.");
    return [];
  }

  return data as MilitaryOrganization[];
};

export const useMilitaryOrganizations = () => {
  return useQuery<MilitaryOrganization[], Error>({
    queryKey: ["militaryOrganizations"],
    queryFn: fetchMilitaryOrganizations,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};