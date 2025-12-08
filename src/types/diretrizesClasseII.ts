export interface DiretrizClasseII {
  id: string;
  user_id: string;
  ano_referencia: number;
  categoria: 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento' | 'Armt L' | 'Armt P' | 'IODCT' | 'DQBRN' | 'Embarcação' | 'Equipamento de Engenharia' | 'Comunicações' | 'Informática' | 'Saúde - KPSI/KPT' | 'Remonta - Mnt/Dia';
  item: string;
  valor_mnt_dia: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiretrizClasseIIForm {
  categoria: 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento' | 'Armt L' | 'Armt P' | 'IODCT' | 'DQBRN' | 'Embarcação' | 'Equipamento de Engenharia' | 'Comunicações' | 'Informática' | 'Saúde - KPSI/KPT' | 'Remonta - Mnt/Dia';
  item: string;
  valor_mnt_dia: number;
}

// Interface para itens complexos de Remonta (Itens B, C, D, E)
export interface RemontaItem {
  item: string;
  animal_tipo: 'Equino' | 'Canino';
  categoria: 'B' | 'C' | 'D' | 'E';
  valor: number;
  unidade: 'ano' | 'mês' | 'animal' | '5 cães/ano';
}