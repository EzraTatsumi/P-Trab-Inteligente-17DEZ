export interface DiretrizClasseI {
  id: string;
  user_id: string;
  ano_referencia: number;
  categoria: 'Viaturas' | 'Aeronaves' | 'Embarcações' | 'Motomecanização';
  item: string;
  valor_mnt_dia: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiretrizClasseIForm {
  categoria: 'Viaturas' | 'Aeronaves' | 'Embarcações' | 'Motomecanização';
  item: string;
  valor_mnt_dia: number;
}