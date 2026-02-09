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
    // NOVO: Campos necessários para cálculo e agrupamento
    quantidade: number; // Quantidade solicitada no PTrab
    valor_total: number; // Valor unitário * quantidade
    nd: '33.90.30' | '33.90.39'; // Natureza da Despesa
    nr_subitem: string; // Número do subitem (ex: 01)
    nome_subitem: string; // Nome do subitem (ex: Material de Escritório)
}

/**
 * Estrutura da Diretriz de Material de Consumo (Tabela diretrizes_material_consumo).
 */
export interface DiretrizMaterialConsumo extends Omit<Tables<'diretrizes_material_consumo'>, 'itens_aquisicao'> {
    // Sobrescreve itens_aquisicao para usar o tipo ItemAquisicao[]
    itens_aquisicao: ItemAquisicao[];
}

/**
 * Estrutura de uma linha lida do Excel, com status de validação, antes de ser agrupada.
 */
export interface StagingRow {
    // Dados do Subitem ND
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string | null;

    // Dados do Item de Aquisição
    codigo_catmat: string;
    descricao_item: string;
    descricao_reduzida: string;
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    // unidade_medida: string; // REMOVIDO

    // Status de Validação
    isValid: boolean;
    errors: string[];
    isDuplicateInternal: boolean; // Duplicidade dentro do arquivo
    isDuplicateExternal: boolean; // Duplicidade de Subitem ND no DB (apenas para o primeiro item do grupo)
    originalRowIndex: number; // Linha original no Excel
}