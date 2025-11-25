export interface DiretrizCusteio {
  id: string;
  user_id: string;
  ano_referencia: number;
  classe_i_valor_qs: number;
  classe_i_valor_qr: number;
  classe_iii_fator_gerador: number;
  classe_iii_fator_embarcacao: number;
  classe_iii_fator_equip_engenharia: number;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}
