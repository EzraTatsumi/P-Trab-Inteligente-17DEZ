export interface ItemAquisicao {
    id: string;
    codigo_catmat: string;
    descricao_item: string;
    descricao_reduzida: string | null;
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    om_nome: string; // Nome da OM do Pregão
    unidade_medida: string; // Unidade de medida do item
    gnd: string; // GND (33.90.30 ou 33.90.39)
    // Campos de PNCP
    data_vigencia_inicial: string;
    data_vigencia_final: string;
    numero_controle_pncp_ata: string;
    quantidade_homologada: number;
}

// SelectedItemAquisicao é o ItemAquisicao com a quantidade solicitada e metadados do Subitem
export interface SelectedItemAquisicao extends ItemAquisicao {
    quantidade_solicitada: number;
    diretriz_id: string;
    nr_subitem: string;
    nome_subitem: string;
}

// DiretrizMaterialConsumo é a linha da tabela diretrizes_material_consumo
export interface DiretrizMaterialConsumo {
    id: string;
    user_id: string;
    ano_referencia: number;
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string | null;
    // O campo itens_aquisicao é JSONB no DB, mas aqui é tipado como ItemAquisicao[]
    itens_aquisicao: ItemAquisicao[]; 
    ativo: boolean;
    created_at: string;
    updated_at: string;
}