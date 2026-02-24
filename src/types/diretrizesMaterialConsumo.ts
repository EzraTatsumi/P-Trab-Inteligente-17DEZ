import { Json } from "@/integrations/supabase/types";

export interface ItemAquisicao {
    id: string;
    descricao_item: string;
    descricao_reduzida?: string;
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    codigo_catmat: string;
    // Campos opcionais para contexto de planejamento
    quantidade?: number;
    valor_total?: number;
    nd?: string;
    nr_subitem?: string;
    nome_subitem?: string;
    unidade_medida?: string;
}

export interface DiretrizMaterialConsumo {
    id: string;
    user_id: string;
    ano_referencia: number;
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string | null;
    itens_aquisicao: ItemAquisicao[];
    ativo: boolean;
    created_at?: string;
    updated_at?: string;
}

// Interface para importação de planilhas
export interface StagingRow {
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string;
    codigo_catmat: string;
    descricao_item: string;
    nome_reduzido: string;
    unidade_medida: string;
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    isValid: boolean;
    errors: string[];
    originalRowIndex: number;
    isDuplicateInternal: boolean;
    isDuplicateExternal: boolean;
}