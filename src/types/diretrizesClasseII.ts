export interface DiretrizClasseII {
  id: string;
  user_id: string;
  ano_referencia: number;
  categoria: 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento';
  item: string;
  valor_mnt_dia: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiretrizClasseIIForm {
  categoria: 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento';
  item: string;
  valor_mnt_dia: number;
}