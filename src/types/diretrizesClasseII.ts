export interface DiretrizClasseII {
  id: string;
  user_id: string;
  ano_referencia: number;
  categoria: 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento' | 'Armt L' | 'Armt P' | 'IODCT' | 'DQBRN' | 'Embarcação' | 'Equipamento de Engenharia' | 'Comunicações' | 'Informática' | 'Saúde' | 'Remonta/Veterinária' | 'Manutenção de Viaturas' | 'Manutenção de Equipamentos' | 'Manutenção de Armamento';
  item: string;
  valor_mnt_dia: number;
  valor_acionamento_mensal: number; // NOVO CAMPO PARA CLASSE IX
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiretrizClasseIIForm {
  categoria: 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento' | 'Armt L' | 'Armt P' | 'IODCT' | 'DQBRN' | 'Embarcação' | 'Equipamento de Engenharia' | 'Comunicações' | 'Informática' | 'Saúde' | 'Remonta/Veterinária' | 'Manutenção de Viaturas' | 'Manutenção de Equipamentos' | 'Manutenção de Armamento';
  item: string;
  valor_mnt_dia: number;
  valor_acionamento_mensal: number; // NOVO CAMPO PARA CLASSE IX
}