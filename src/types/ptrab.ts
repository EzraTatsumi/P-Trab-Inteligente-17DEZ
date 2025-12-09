export type PTrabId = string;

export interface PTrabSummary {
  id: PTrabId;
  user_id: string;
  numero_ptrab: string;
  comando_militar_area: string;
  nome_om: string;
  nome_operacao: string;
  periodo_inicio: string;
  periodo_fim: string;
  efetivo_empregado: string;
  status: 'aberto' | 'em_andamento' | 'aprovado' | 'arquivado' | 'minuta';
  created_at: string;
  updated_at: string;
  origem: 'original' | 'copia';
  rotulo_versao?: string | null;
  share_token?: string | null;
  shared_with?: string[] | null;
  
  // Placeholder for calculated total cost (client-side or server-side)
  totalLogistica?: number; 
}

export interface PTrabDetail extends PTrabSummary {
  acoes: string;
  nome_cmt_om?: string;
  local_om?: string;
  comentario?: string;
}

// Simplified types for cost calculation (used internally by hooks)
export interface ClasseIRecord {
    id: string;
    p_trab_id: PTrabId;
    total_qs: number;
    total_qr: number;
}

export interface ClasseII_VIII_Record {
    id: string;
    p_trab_id: PTrabId;
    valor_nd_30: number;
    valor_nd_39: number;
}

export interface ClasseIIIRecord {
    id: string;
    p_trab_id: PTrabId;
    tipo_equipamento: string;
    valor_total: number;
}