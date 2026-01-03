import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

const fetchDiretrizesOperacionais = async (userId: string): Promise<DiretrizOperacional | null> => {
  // 1. Buscar o ano padrão do perfil
  const { data: profileData } = await supabase
    .from('profiles')
    .select('default_diretriz_year')
    .eq('id', userId)
    .maybeSingle();

  const defaultYear = profileData?.default_diretriz_year;
  
  let yearToFetch = defaultYear;

  // 2. Se não houver ano padrão, buscar o ano mais recente disponível
  if (!yearToFetch) {
    const { data: latestYearData } = await supabase
      .from('diretrizes_operacionais')
      .select('ano_referencia')
      .eq('user_id', userId)
      .order('ano_referencia', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    yearToFetch = latestYearData?.ano_referencia;
  }
  
  if (!yearToFetch) {
    // Se não houver diretrizes salvas, retorna null
    return null;
  }

  // 3. Buscar a diretriz para o ano determinado
  const { data, error } = await supabase
    .from("diretrizes_operacionais")
    .select("*")
    .eq("user_id", userId)
    .eq("ano_referencia", yearToFetch)
    .maybeSingle();

  if (error) throw error;
  
  // Mapear campos numéricos para garantir o tipo correto
  if (data) {
    return {
      ...data,
      fator_passagens_aereas: Number(data.fator_passagens_aereas),
      fator_servicos_terceiros: Number(data.fator_servicos_terceiros),
      valor_verba_operacional_dia: Number(data.valor_verba_operacional_dia),
      valor_suprimentos_fundo_dia: Number(data.valor_suprimentos_fundo_dia),
      valor_complemento_alimentacao: Number(data.valor_complemento_alimentacao),
      valor_fretamento_aereo_hora: Number(data.valor_fretamento_aereo_hora),
      valor_locacao_estrutura_dia: Number(data.valor_locacao_estrutura_dia),
      valor_locacao_viaturas_dia: Number(data.valor_locacao_viaturas_dia),
      fator_material_consumo: Number(data.fator_material_consumo),
      fator_concessionaria: Number(data.fator_concessionaria),
      
      diaria_of_gen_bsb: Number(data.diaria_of_gen_bsb),
      diaria_of_gen_capitais: Number(data.diaria_of_gen_capitais),
      diaria_of_gen_demais: Number(data.diaria_of_gen_demais),
      diaria_of_sup_bsb: Number(data.diaria_of_sup_bsb),
      diaria_of_sup_capitais: Number(data.diaria_of_sup_capitais),
      diaria_of_sup_demais: Number(data.diaria_of_sup_demais),
      diaria_of_int_sgt_bsb: Number(data.diaria_of_int_sgt_bsb),
      diaria_of_int_sgt_capitais: Number(data.diaria_of_int_sgt_capitais),
      diaria_of_int_sgt_demais: Number(data.diaria_of_int_sgt_demais),
      diaria_demais_pracas_bsb: Number(data.diaria_demais_pracas_bsb),
      diaria_demais_pracas_capitais: Number(data.diaria_demais_pracas_capitais),
      diaria_demais_pracas_demais: Number(data.diaria_demais_pracas_demais),
      taxa_embarque: Number(data.taxa_embarque),
    } as DiretrizOperacional;
  }

  return null;
};

export const useDiretrizesOperacionais = () => {
  // Acessa a sessão de forma segura
  const { data: { user } } = supabase.auth.getSession();
  const userId = user?.id;

  return useQuery({
    queryKey: ["diretrizesOperacionais", userId],
    queryFn: () => fetchDiretrizesOperacionais(userId!),
    enabled: !!userId, // A query só é executada se o userId estiver disponível
    staleTime: 1000 * 60 * 5, // 5 minutes
    onError: (error) => {
      toast.error(error.message);
    }
  });
};