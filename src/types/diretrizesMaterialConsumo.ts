import { Tables } from "@/integrations/supabase/types";

/**
 * Estrutura de um item de aquisição dentro de uma Diretriz de Material de Consumo.
 */
export interface ItemAquisicao {
    id: string; // ID local temporário para manipulação no frontend
    descricao_item: string; // Descrição completa do item
    descricao_reduzida: string; // Novo campo: Descrição reduzida do item
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    codigo_catmat: string;
}

/**
 * Estrutura da Diretriz de Material de Consumo (Tabela diretrizes_material_consumo).
 */
export interface DiretrizMaterialConsumo extends Omit<Tables<'diretrizes_material_consumo'>, 'itens_aquisicao'> {
    // Sobrescreve itens_aquisicao para usar o tipo ItemAquisicao[]
    itens_aquisicao: ItemAquisicao[];
}