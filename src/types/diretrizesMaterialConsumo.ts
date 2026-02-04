import * as z from "zod";
import { Tables } from "@/integrations/supabase/types";

// Nível 3: Categorias (Subitens da ND 30)
export type DiretrizMaterialConsumoCategoria = Tables<'diretrizes_material_consumo_categorias'>;

export const materialConsumoCategoriaSchema = z.object({
  nome_categoria: z.string().min(3, "O nome da categoria é obrigatório."),
  observacoes: z.string().optional().nullable(),
});

export type DiretrizMaterialConsumoCategoriaForm = z.infer<typeof materialConsumoCategoriaSchema>;

// Nível 4: Itens Específicos
export type DiretrizMaterialConsumoItem = Tables<'diretrizes_material_consumo_itens'>;

export const materialConsumoItemSchema = z.object({
  descricao_item: z.string().min(3, "A descrição do item é obrigatória."),
  preco_unitario: z.number().min(0.01, "O preço unitário deve ser maior que zero."),
  numero_pregao: z.string().optional().nullable(),
  uasg_referencia: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
});

export type DiretrizMaterialConsumoItemForm = z.infer<typeof materialConsumoItemSchema>;
