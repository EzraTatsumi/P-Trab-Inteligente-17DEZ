import { Json } from "@/integrations/supabase/types";

export interface ItemAquisicaoServico {
    id: string;
    descricao_item: string;
    descricao_reduzida: string | null;
    codigo_catmat: string;
    codigo_catser?: string; // Adicionado para compatibilidade com serviços
    valor_unitario: number;
    unidade_medida: string;
    numero_pregao: string;
    uasg: string;
    nd: string; // '30' ou '39'
    // Campos injetados para controle de UI
    quantidade?: number;
    valor_total?: number;
    periodo?: number; // Adicionado para controle de tempo/frequência
    nr_subitem?: string;
    nome_subitem?: string;
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

// Estrutura do JSONB na tabela de registros
export interface DetalhesPlanejamentoServico {
    itens_selecionados: ItemAquisicaoServico[];
    parametros_adicionais?: Record<string, any>;
}