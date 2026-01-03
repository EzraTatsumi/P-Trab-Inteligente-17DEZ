import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DiariaRegistro } from "@/types/diaria";

const fetchDiariaRegistros = async (p_trab_id: string): Promise<DiariaRegistro[]> => {
  if (!p_trab_id) return [];

  const { data, error } = await supabase
    .from("diaria_registros")
    .select("*")
    .eq("p_trab_id", p_trab_id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar registros de Diária:", error);
    throw new Error("Falha ao carregar registros de Diária.");
  }

  // Mapear campos numéricos e novos campos para garantir o tipo correto
  return (data || []).map(r => ({
    ...r,
    valor_diaria_unitario: Number(r.valor_diaria_unitario),
    valor_taxa_embarque: Number(r.valor_taxa_embarque),
    valor_total: Number(r.valor_total),
    valor_nd_30: Number(r.valor_nd_30),
    valor_nd_39: Number(r.valor_nd_39),
    // Novos campos
    nr_viagens: r.nr_viagens || 1,
    local_atividade: r.local_atividade || null,
    quantidades_por_posto: r.quantidades_por_posto || null,
  })) as DiariaRegistro[];
};

export const useDiariaRegistros = (p_trab_id: string | null) => {
  return useQuery({
    queryKey: ["diariaRegistros", p_trab_id],
    queryFn: () => fetchDiariaRegistros(p_trab_id!),
    enabled: !!p_trab_id,
    staleTime: 1000 * 60 * 1, // 1 minute
    onError: (error) => {
      toast.error(error.message);
    }
  });
};