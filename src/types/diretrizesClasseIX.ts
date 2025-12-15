export interface DiretrizClasseIX {
  id: string;
  user_id: string;
  ano_referencia: number;
  categoria: 'Vtr Administrativa' | 'Vtr Operacional' | 'Motocicleta' | 'Vtr Blindada';
  item: string;
  valor_mnt_dia: number;
  valor_acionamento_mensal: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiretrizClasseIXForm {
  categoria: 'Vtr Administrativa' | 'Vtr Operacional' | 'Motocicleta' | 'Vtr Blindada';
  item: string;
  valor_mnt_dia: number;
  valor_acionamento_mensal: number;
  ativo?: boolean;
}