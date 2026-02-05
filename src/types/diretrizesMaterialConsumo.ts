import { Tables } from "@/integrations/supabase/types";

// Estrutura do Item de Aquisição (dentro do JSONB)
export interface ItemAquisicao {
    id: string; // ID local para gerenciamento no React
    descricao_item: string;
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    codigo_catmat: string; // NOVO: Código do Catálogo de Material
}

// Estrutura base da diretriz (Subitem da ND)
export interface DiretrizMaterialConsumo extends Tables<'diretrizes_material_consumo'> {
    // Sobrescreve o tipo JSONB para garantir que seja ItemAquisicao[]
    itens_aquisicao: ItemAquisicao[];
}

// Estrutura do formulário (sem campos de sistema)
export interface DiretrizMaterialConsumoForm extends Omit<DiretrizMaterialConsumo, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'ano_referencia'> {
    // O ano de referência será injetado pelo componente pai
}