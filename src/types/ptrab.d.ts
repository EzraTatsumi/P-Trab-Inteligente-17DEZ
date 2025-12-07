export interface PTrab {
  id: string;
  user_id: string;
  numero_ptrab: string | null;
  comando_militar_area: string;
  nome_om: string;
  nome_om_extenso: string | null;
  codug_om: string | null;
  rm_vinculacao: string | null;
  codug_rm_vinculacao: string | null;
  nome_operacao: string;
  periodo_inicio: string;
  periodo_fim: string;
  efetivo_empregado: string;
  acoes: string | null;
  status: 'aberto' | 'finalizado' | 'arquivado';
  nome_cmt_om: string | null;
  local_om: string | null;
  comentario: string | null;
  created_at: string;
  updated_at: string;
  origem: 'original' | 'copia';
  rotulo_versao: string | null;
  share_token: string | null;
  shared_with: string[] | null; // Array of UUIDs
}