import { ItemAquisicao } from "./diretrizesMaterialConsumo";

export interface ItemAquisicaoServico extends ItemAquisicao {}

export interface DiretrizServicosTerceiros {
    id: string;
    user_id: string;
    ano_referencia: number;
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string | null;
    itens_aquisicao: ItemAquisicaoServico[];
    ativo: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface DiretrizServicosTerceirosForm {
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem?: string;
    ativo: boolean;
    itens_aquisicao: ItemAquisicaoServico[];
}