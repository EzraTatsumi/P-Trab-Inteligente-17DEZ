export interface MaterialConsumoSubitem {
  id: string;
  user_id: string;
  nome: string;
  nr_subitem: string | null; // Novo campo
  descricao: string | null; // Novo campo
  created_at: string;
  updated_at: string;
}

export type MaterialConsumoSubitemInsert = Omit<MaterialConsumoSubitem, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type MaterialConsumoSubitemUpdate = Partial<MaterialConsumoSubitemInsert>;

export interface MaterialConsumoItem {
  id: string;
  user_id: string;
  subitem_id: string;
  descricao: string;
  preco_unitario: number;
  pregao: string | null;
  uasg: string | null;
  created_at: string;
  updated_at: string;
}

export type MaterialConsumoItemInsert = Omit<MaterialConsumoItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type MaterialConsumoItemUpdate = Partial<MaterialConsumoItemInsert>;