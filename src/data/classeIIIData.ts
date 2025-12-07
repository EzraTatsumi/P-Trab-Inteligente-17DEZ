import { supabase } from "@/integrations/supabase/client";
import { DiretrizClasseIIForm } from "@/types/diretrizesClasseII";

export interface TipoEquipamentoDetalhado {
  nome: string;
  combustivel: 'GAS' | 'OD';
  consumo: number;
  unidade: 'L/h' | 'km/L';
}

// Valores padrão (fallback se não houver diretrizes)
export const grupoGeradores: TipoEquipamentoDetalhado[] = [
  { nome: "Gerador até 15 kva GAS", combustivel: "GAS", consumo: 1.25, unidade: "L/h" },
  { nome: "Gerador até 15 kva OD", combustivel: "OD", consumo: 4.0, unidade: "L/h" },
  { nome: "Gerador acima de 50 kva", combustivel: "OD", consumo: 20.0, unidade: "L/h" },
];

export const tipoEmbarcacoes: TipoEquipamentoDetalhado[] = [
  { nome: "Motor de popa", combustivel: "GAS", consumo: 20, unidade: "L/h" },
  { nome: "Emb Guardian 25", combustivel: "GAS", consumo: 100, unidade: "L/h" },
  { nome: "Ferryboat", combustivel: "OD", consumo: 100, unidade: "L/h" },
  { nome: "Emb Regional", combustivel: "OD", consumo: 50, unidade: "L/h" },
  { nome: "Empurradores", combustivel: "OD", consumo: 80, unidade: "L/h" },
  { nome: "Emb Manobra", combustivel: "OD", consumo: 30, unidade: "L/h" },
];

export const tipoEquipamentosEngenharia: TipoEquipamentoDetalhado[] = [
  { nome: "Retroescavadeira", combustivel: "OD", consumo: 7, unidade: "L/h" },
  { nome: "Carregadeira sobre rodas", combustivel: "OD", consumo: 16, unidade: "L/h" },
  { nome: "Motoniveladora", combustivel: "OD", consumo: 18, unidade: "L/h" },
];

export const tipoViaturas: TipoEquipamentoDetalhado[] = [
  { nome: "Vtr Adm Pqn Porte - Adm Pqn", combustivel: "GAS", consumo: 8, unidade: "km/L" },
  { nome: "Vtr Adm Pqn Porte - Pick-up", combustivel: "OD", consumo: 7, unidade: "km/L" },
  { nome: "Vtr Adm Pqn Porte - Van/Micro", combustivel: "OD", consumo: 6, unidade: "km/L" },
  { nome: "Vtr Adm Gde Porte - Cav Mec", combustivel: "OD", consumo: 1.3, unidade: "km/L" },
  { nome: "Vtr Adm Gde Porte - Ônibus/Cav Mec", combustivel: "OD", consumo: 3, unidade: "km/L" },
  { nome: "Vtr Op Leve - Marruá", combustivel: "OD", consumo: 5, unidade: "km/L" },
  { nome: "Vtr Op Gde Porte - Vtr 5 ton", combustivel: "OD", consumo: 3, unidade: "km/L" },
  { nome: "Motocicleta - até 1.000cc", combustivel: "GAS", consumo: 15, unidade: "km/L" },
  { nome: "Motocicleta - acima de 1.000cc", combustivel: "GAS", consumo: 7, unidade: "km/L" },
  { nome: "Vtr Bld SR", combustivel: "OD", consumo: 1.5, unidade: "km/L" },
  { nome: "Vtr Bld SL", combustivel: "OD", consumo: 0.5, unidade: "km/L" },
  { nome: "Vtr Bld L SR - LINCE", combustivel: "OD", consumo: 4, unidade: "km/L" },
];

// NEW: Default configuration for Classe III maintenance (placeholder values)
export const defaultClasseIIIConfig: DiretrizClasseIIForm[] = [
  // Combustível (Placeholder for maintenance related to fuel systems, if applicable)
  { categoria: "Combustível", item: "Manutenção de Tanques", valor_mnt_dia: 5.00 },
  { categoria: "Combustível", item: "Manutenção de Bombas", valor_mnt_dia: 3.50 },
  // Lubrificante (Placeholder for maintenance related to lubricant systems)
  { categoria: "Lubrificante", item: "Manutenção de Filtros", valor_mnt_dia: 2.00 },
  // Embarcação (Using maintenance values from Classe VI default)
  { categoria: "Embarcação", item: "Embarcação Guardian", valor_mnt_dia: 354.11 },
  { categoria: "Embarcação", item: "Motor de Popa", valor_mnt_dia: 9.73 },
  // Equipamento de Engenharia (Using maintenance values from Classe VI default)
  { categoria: "Equipamento de Engenharia", item: "Retroescavadeira", valor_mnt_dia: 74.33 },
  { categoria: "Equipamento de Engenharia", item: "Trator de Esteiras", valor_mnt_dia: 189.51 },
];

// Função helper para retornar valores padrão
export function getFallbackEquipamentos(tipo: string): TipoEquipamentoDetalhado[] {
  switch (tipo) {
    case 'GERADOR':
      return grupoGeradores;
    case 'EMBARCACAO':
      return tipoEmbarcacoes;
    case 'EQUIPAMENTO_ENGENHARIA':
      return tipoEquipamentosEngenharia;
    case 'MOTOMECANIZACAO':
      return tipoViaturas;
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