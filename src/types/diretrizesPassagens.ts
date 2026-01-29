export type TipoTransporte = 'AÉREO' | 'TERRESTRE' | 'FLUVIAL';

export interface TrechoPassagem {
  id: string;
  origem: string;
  destino: string;
  valor: number;
  tipo_transporte: TipoTransporte;
  is_ida_volta: boolean; // true para Ida/Volta, false para Ida
}

export interface DiretrizPassagem {
  id: string;
  user_id: string;
  ano_referencia: number;
  om_referencia: string;
  ug_referencia: string;
  numero_pregao: string | null;
  trechos: TrechoPassagem[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiretrizPassagemForm {
  om_referencia: string;
  ug_referencia: string;
  numero_pregao: string;
}