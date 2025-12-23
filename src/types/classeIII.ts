import { Tables } from "@/integrations/supabase/types";

// Tipo base para um registro de Classe III (diretamente do Supabase)
export interface ClasseIII extends Tables<'classe_iii_registros'> {}

// Tipo para um item de equipamento dentro do formulário (não usado diretamente no DB, mas na lógica)
export interface ClasseIIIItem {
  id: string;
  nome: string;
  tipo: string;
  quantidade: number;
  consumo: number;
  unidade: 'L/h' | 'km/L';
  tipo_combustivel: 'GAS' | 'OD';
  preco_litro: number;
  valor_total: number;
}

// Tipo para o estado do formulário de Classe III
export interface ClasseIIIForm {
  organizacao: string;
  ug: string;
  dias_operacao: number;
  tipo_equipamento: 'Viatura' | 'Gerador' | 'Embarcação' | 'Equipamento de Engenharia';
  registros: ClasseIIIItem[];
}