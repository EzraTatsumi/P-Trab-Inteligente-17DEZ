export interface DiretrizClasseII {
  id: string;
  user_id: string;
  ano_referencia: number;
  categoria: 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento' | 'Armt L' | 'Armt P' | 'IODCT' | 'DQBRN' | 'Embarcação' | 'Equipamento de Engenharia' | 'Comunicações' | 'Informática' | 'Saúde' | 'Remonta/Veterinária';
  item: string;
  valor_mnt_dia: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiretrizClasseIIForm {
  categoria: 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento' | 'Armt L' | 'Armt P' | 'IODCT' | 'DQBRN' | 'Embarcação' | 'Equipamento de Engenharia' | 'Comunicações' | 'Informática' | 'Saúde' | 'Remonta/Veterinária';
  item: string;
  valor_mnt_dia: number;
}