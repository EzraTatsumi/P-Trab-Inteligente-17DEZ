import { Json } from "@/integrations/supabase/types";

export interface ItemAquisicaoPermanente {
    id: string;
    descricao_item: string;
    descricao_reduzida: string;
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    codigo_catmat: string;
    quantidade?: number;
    valor_total?: number;
    nd?: string;
    nr_subitem?: string;
    nome_subitem?: string;
    justificativa?: {
        grupo?: string;
        proposito?: string;
        destinacao?: string;
        local?: string;
        finalidade?: string;
        motivo?: string;
    };
}

export interface DiretrizMaterialPermanente {
    id: string;
    user_id: string;
    ano_referencia: number;
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string | null;
    itens_aquisicao: ItemAquisicaoPermanente[];
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface ConsolidatedPermanenteRecord {
    groupKey: string;
    organizacao: string;
    ug: string;
    records: any[];
    totalGeral: number;
}

export interface StagingRowPermanente {
    originalRowIndex: number;
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string;
    codigo_catmat: string;
    descricao_item: string;
    descricao_reduzida: string;
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    isValid: boolean;
    errors: string[];
    isDuplicateInternal: boolean;
    isDuplicateExternal: boolean;
}