import { supabase } from "@/integrations/supabase/client";
import { defaultDirectives, TipoEquipamentoDetalhado } from "./defaultDirectives";

export { TipoEquipamentoDetalhado };

// Função helper para retornar valores padrão
export function getFallbackEquipamentos(tipo: string): TipoEquipamentoDetalhado[] {
  switch (tipo) {
    case 'GERADOR':
      return defaultDirectives.grupoGeradores;
    case 'EMBARCACAO':
      return defaultDirectives.tipoEmbarcacoes;
    case 'EQUIPAMENTO_ENGENHARIA':
      return defaultDirectives.tipoEquipamentosEngenharia;
    case 'MOTOMECANIZACAO':
      return defaultDirectives.tipoViaturas;
    default:
      return [];
  }
}

// Função assíncrona para buscar equipamentos configurados
export async function getEquipamentosPorTipo(tipo: string): Promise<TipoEquipamentoDetalhado[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return getFallbackEquipamentos(tipo);

    let anoReferencia: number | null = null;

    // 1. Tentar buscar o ano padrão do perfil do usuário
    const { data: profileData } = await supabase
      .from("profiles")
      .select("default_diretriz_year")
      .eq("id", user.id)
      .maybeSingle();
      
    if (profileData?.default_diretriz_year) {
        anoReferencia = profileData.default_diretriz_year;
    }

    // 2. Se não houver ano padrão, buscar o ano mais recente na tabela de diretrizes
    if (!anoReferencia) {
        const { data: diretrizData } = await supabase
          .from("diretrizes_custeio")
          .select("ano_referencia")
          .eq("user_id", user.id)
          .order("ano_referencia", { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (diretrizData) {
            anoReferencia = diretrizData.ano_referencia;
        }
    }
    
    if (!anoReferencia) return getFallbackEquipamentos(tipo);

    // 3. Buscar equipamentos configurados usando o ano de referência encontrado
    const { data: equipamentos } = await supabase
      .from("diretrizes_equipamentos_classe_iii")
      .select("*")
      .eq("user_id", user.id)
      .eq("ano_referencia", anoReferencia)
      .eq("categoria", tipo)
      .eq("ativo", true);

    if (equipamentos && equipamentos.length > 0) {
      return equipamentos.map(eq => ({
        nome: eq.nome_equipamento,
        combustivel: eq.tipo_combustivel as 'GAS' | 'OD',
        consumo: Number(eq.consumo),
        unidade: eq.unidade as 'L/h' | 'km/L',
      }));
    }

    return getFallbackEquipamentos(tipo);
  } catch (error) {
    console.error("Erro ao buscar equipamentos:", error);
    return getFallbackEquipamentos(tipo);
  }
}