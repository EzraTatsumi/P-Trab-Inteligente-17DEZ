import { ItemAquisicao } from "./diretrizesMaterialConsumo";

export interface ItemAquisicaoMaterial extends ItemAquisicao {
    unidade_medida?: string;
}

// Alias for compatibility with components using this name
export type ItemAquisicaoPermanente = ItemAquisicaoMaterial;

export interface DiretrizMaterialPermanente {
    id: string;
    user_id: string;
    ano_referencia: number;
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem?: string;
    itens_aquisicao: ItemAquisicaoMaterial[];
    ativo: boolean;
    created_at?: string;
    updated_at?: string;
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