export interface ItemAquisicaoServico {
    id: string;
    descricao_item: string;
    descricao_reduzida: string;
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    codigo_catmat: string;
    nd: string;
    nome_reduzido?: string;
    unidade_medida?: string;
}

export interface DiretrizServicosTerceiros {
    id: string;
    user_id: string;
    ano_referencia: number;
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string | null;
    itens_aquisicao: ItemAquisicaoServico[];
    ativo: boolean;
    created_at: string;
    updated_at: string;
}