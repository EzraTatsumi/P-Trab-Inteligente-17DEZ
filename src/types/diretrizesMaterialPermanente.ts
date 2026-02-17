import { ItemAquisicao } from "./diretrizesMaterialConsumo";

export interface DiretrizMaterialPermanente {
    id: string;
    user_id: string;
    ano_referencia: number;
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string | null;
    itens_aquisicao: ItemAquisicao[];
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface ItemAquisicaoPermanente extends ItemAquisicao {
    // Pode ser estendido se necessário, mas por enquanto usa a mesma estrutura
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