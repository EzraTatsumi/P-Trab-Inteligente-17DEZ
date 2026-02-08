import { Tables } from "@/integrations/supabase/types";

/**
 * Representa um item de aquisição (CATMAT/PNCP) dentro de uma diretriz de Material de Consumo.
 */
export interface ItemAquisicao {
    id: string; // ID único do item (e.g., PNCP ID ou UUID)
    codigo_catmat: string;
    descricao_item: string; // Descrição completa
    descricao_reduzida: string; // Descrição curta (para exibição)
    valor_unitario: number;
    unidade_medida: string;
    numero_pregao: string;
    uasg: string;
    gnd: '33.90.30' | '33.90.39';
    // Campos adicionais para rastreamento de origem (preenchidos no seletor)
    diretriz_id: string;
    nr_subitem: string;
    nome_subitem: string;
}

/**
 * Representa a estrutura completa de uma diretriz de Material de Consumo.
 */
export type DiretrizMaterialConsumo = Tables<'diretrizes_material_consumo'> & {
    // Sobrescreve o tipo Json para garantir que é um array de ItemAquisicao
    itens_aquisicao: ItemAquisicao[];
};