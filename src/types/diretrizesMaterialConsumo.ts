import { Json } from "@/integrations/supabase/types";

export interface ItemAquisicao {
    id: string;
    descricao_item: string;
    descricao_reduzida?: string;
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    codigo_catmat: string;
    // Campos opcionais usados no contexto de planejamento/P Trab
    quantidade?: number;
    valor_total?: number;
    nd?: string;
    nr_subitem?: string;
    nome_subitem?: string;
    unidade_medida?: string;
}

export interface DiretrizMaterialConsumo {
    id: string;
    user_id: string;
    ano_referencia: number;
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string | null;
    itens_aquisicao: ItemAquisicao[];
    ativo: boolean;
    created_at?: string;
    updated_at?: string;
}

// Tipos específicos para a funcionalidade de Grupos no formulário do P Trab
export interface MaterialConsumoItem extends ItemAquisicao {
    quantidade: number;
    valor_total: number;
}

export interface MaterialConsumoGroup {
    id: string;
    nome_grupo: string;
    itens: MaterialConsumoItem[];
    valor_total: number;
}