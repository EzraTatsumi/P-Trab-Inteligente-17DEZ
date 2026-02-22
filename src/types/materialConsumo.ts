"use client";

export interface MaterialConsumoItem {
    id: string;
    descricao_item: string;
    valor_unitario: number;
    quantidade: number;
    valor_total: number;
    codigo_catmat: string;
    numero_pregao: string;
    uasg: string;
    nr_subitem: string;
    nome_subitem: string;
    unidade_medida?: string;
}

export interface MaterialConsumoGroup {
    id: string;
    nome_grupo: string;
    itens: MaterialConsumoItem[];
    valor_total: number;
}