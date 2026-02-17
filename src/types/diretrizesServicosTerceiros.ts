export interface ItemAquisicaoServico {
    id: string;
    descricao_item: string;
    descricao_reduzida?: string;
    nome_reduzido?: string;
    unidade_medida?: string;
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    codigo_catmat?: string;
    codigo_catser?: string;
    nd?: string;
    natureza_despesa?: '33' | '39';
    // Propriedades adicionadas para uso no planejamento (P Trab)
    quantidade?: number;
    periodo?: number;
    valor_total?: number;
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