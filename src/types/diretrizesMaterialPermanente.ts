import { ItemAquisicao } from "./diretrizesMaterialConsumo";

// Exportando o tipo para resolver erros de importação em outros componentes
export type ItemAquisicaoPermanente = ItemAquisicao;

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