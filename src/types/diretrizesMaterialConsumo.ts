import * as z from "zod";
import { Tables } from "@/integrations/supabase/types";

// --- Material de Consumo - Categorias (Nível 3) ---

export type DiretrizMaterialConsumoCategoria = Tables<'diretrizes_material_consumo_categorias'>;

export type DiretrizMaterialConsumoCategoriaForm = {
    id?: string;
    nome_categoria: string;
    observacoes?: string | null;
};

export const materialConsumoCategoriaSchema = z.object({
    nome_categoria: z.string().min(3, "O nome da categoria deve ter pelo menos 3 caracteres."),
    observacoes: z.string().optional().nullable(),
});

// --- Material de Consumo - Itens (Nível 4) ---

export type DiretrizMaterialConsumoItem = Tables<'diretrizes_material_consumo_itens'>;

export type DiretrizMaterialConsumoItemForm = {
    id?: string;
    categoria_id: string; // Foreign key
    descricao_item: string;
    preco_unitario: number;
    numero_pregao?: string | null;
    uasg_referencia?: string | null;
    ativo: boolean;
};

export const materialConsumoItemSchema = z.object({
    categoria_id: z.string().uuid("ID da categoria inválido."),
    descricao_item: z.string().min(5, "A descrição do item deve ser detalhada (mínimo 5 caracteres)."),
    preco_unitario: z.number().min(0.01, "O preço unitário deve ser maior que zero."),
    numero_pregao: z.string().optional().nullable(),
    uasg_referencia: z.string().optional().nullable(),
    ativo: z.boolean(),
});
