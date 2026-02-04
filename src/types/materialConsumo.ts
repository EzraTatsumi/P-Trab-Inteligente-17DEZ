import { Tables } from "@/integrations/supabase/types";

export type MaterialConsumoSubitem = Tables<"material_consumo_subitens">;
export type MaterialConsumoItem = Tables<"material_consumo_itens">;

export type MaterialConsumoItemInsert = Omit<Tables<"material_consumo_itens">, "id" | "created_at" | "user_id">;
export type MaterialConsumoSubitemInsert = Omit<Tables<"material_consumo_subitens">, "id" | "created_at" | "user_id">;

export type MaterialConsumoItemUpdate = Partial<MaterialConsumoItemInsert>;
export type MaterialConsumoSubitemUpdate = Partial<MaterialConsumoSubitemInsert>;

export interface MaterialConsumoItemWithSubitem extends MaterialConsumoItem {
  material_consumo_subitens: MaterialConsumoSubitem;
}