export interface ItemAquisicaoMaterial {
    id: string;
    codigo_catmat: string;
    descricao_item: string;
    descricao_reduzida: string;
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    unidade_medida: string;
}

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