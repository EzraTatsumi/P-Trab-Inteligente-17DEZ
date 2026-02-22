export interface CatalogoSubitem {
    id: string;
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string | null;
    ativo: boolean;
    created_at?: string;
    updated_at?: string;
}