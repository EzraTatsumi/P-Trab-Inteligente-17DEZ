export interface DiretrizEquipamentoClasse3 {
  id: string;
  user_id: string;
  ano_referencia: number;
  categoria: 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
  nome_equipamento: string;
  tipo_combustivel: 'GAS' | 'OD';
  consumo: number;
  unidade: 'L/h' | 'km/L';
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiretrizEquipamentoForm {
  nome_equipamento: string;
  tipo_combustivel: 'GAS' | 'OD';
  consumo: number;
  unidade: 'L/h' | 'km/L';
}
