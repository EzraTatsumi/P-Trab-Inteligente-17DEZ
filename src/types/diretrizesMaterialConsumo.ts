import { Tables } from "@/integrations/supabase/types";

// Tipo base para a diretriz de Material de Consumo
export type DiretrizMaterialConsumo = Tables<'diretrizes_material_consumo'> & {
    // Sobrescreve itens_aquisicao para ser um array tipado
    itens_aquisicao: ItemAquisicao[];
};

// Tipo para um item de aquisição dentro da diretriz (vindo do PNCP ou manual)
export interface ItemAquisicao {
    id: string; // ID único do item (gerado ou PNCP ID)
    codigo_catmat: string;
    descricao_item: string; // Descrição completa
    descricao_reduzida: string; // Descrição reduzida (do catálogo CATMAT)
    valor_unitario: number;
    unidade_medida: string; // Ex: UN, KG, LT
    numero_pregao: string; // Pregão formatado (ex: 1/24) ou Ref. Preço
    uasg: string; // UASG do órgão gerenciador
    om_nome: string; // Nome da OM gerenciadora
    data_vigencia_final: string;
    gnd: '33.90.30' | '33.90.39'; // Natureza da Despesa (Consumo ou Permanente)
}