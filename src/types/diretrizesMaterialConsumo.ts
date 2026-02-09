import { Tables } from "@/integrations/supabase/types";

// Estrutura de um item de aquisição importado do PNCP e armazenado na diretriz
export interface ItemAquisicao {
    id: string; // ID único (geralmente combinação de PNCP ID e número do item)
    codigo_catmat: string;
    descricao_item: string;
    descricao_reduzida: string | null;
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    om_nome: string;
    
    // Propriedades adicionadas para cálculo e agrupamento
    quantidade: number; // Quantidade solicitada no PTrab
    valor_total: number; // valor_unitario * quantidade
    nd: '33.90.30' | '33.90.39'; // Natureza da Despesa
    
    // Propriedades injetadas do Subitem da ND (para rastreamento)
    nr_subitem: string;
    nome_subitem: string;
}

// Estrutura da tabela diretrizes_material_consumo
export type DiretrizMaterialConsumo = Tables<'diretrizes_material_consumo'> & {
    itens_aquisicao: ItemAquisicao[]; // Sobrescreve o tipo Json
};