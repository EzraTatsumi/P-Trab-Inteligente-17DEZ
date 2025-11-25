export interface RefLPC {
  id: string;
  p_trab_id: string;
  data_inicio_consulta: string;
  data_fim_consulta: string;
  ambito: 'Nacional' | 'Estadual' | 'Municipal';
  nome_local?: string;
  preco_diesel: number;
  preco_gasolina: number;
  created_at: string;
  updated_at: string;
}

export interface RefLPCForm {
  data_inicio_consulta: string;
  data_fim_consulta: string;
  ambito: 'Nacional' | 'Estadual' | 'Municipal';
  nome_local?: string;
  preco_diesel: number;
  preco_gasolina: number;
}
