// Tipos para a consulta PNCP

export interface ArpUasgSearchParams {
    codigoUnidadeGerenciadora: string;
    dataVigenciaInicialMin: string;
    dataVigenciaInicialMax: string;
}

/**
 * Estrutura bruta de um item ARP retornado pela API externa (1_consultarARP).
 */
export interface ArpRawResult {
    numeroAtaRegistroPreco: string;
    codigoUnidadeGerenciadora: string;
    nomeUnidadeGerenciadora: string;
    numeroCompra: string;
    anoCompra: string;
    dataVigenciaInicial: string;
    dataVigenciaFinal: string;
    valorTotal: number;
    objeto: string;
    quantidadeItens: number;
    idCompra: string; // Usado como ID único
    numeroControlePncpAta: string; // Adicionado para busca de itens detalhados
}

/**
 * Estrutura simplificada e mapeada para uso no frontend (Nível 1).
 */
export interface ArpItemResult {
    id: string;
    numeroAta: string;
    objeto: string;
    uasg: string;
    omNome: string; // Adicionado omNome
    dataVigenciaInicial: string;
    dataVigenciaFinal: string;
    valorTotalEstimado: number;
    quantidadeItens: number;
    pregaoFormatado: string;
    numeroControlePncpAta: string; // Adicionado para busca de itens detalhados
}

/**
 * Estrutura bruta de um item detalhado ARP retornado pela API externa (2.1_consultarARPItem_Id).
 */
export interface DetailedArpRawResult {
    numeroAtaRegistroPreco: string;
    codigoUnidadeGerenciadora: string;
    numeroCompra: string;
    anoCompra: string;
    dataVigenciaInicial: string;
    dataVigenciaFinal: string;
    numeroItem: string;
    codigoItem: number; // CATMAT code
    descricaoItem: string;
    valorUnitario: number;
    quantidadeHomologadaItem: number;
    valorTotal: number;
    numeroControlePncpAta: string;
}

/**
 * Estrutura simplificada e mapeada para uso no frontend (Nível 2).
 */
export interface DetailedArpItem {
    id: string; // Unique ID for the item (ARP Control + Item Number)
    numeroAta: string;
    codigoItem: string; // CATMAT code as string
    descricaoItem: string;
    valorUnitario: number;
    quantidadeHomologada: number;
    numeroControlePncpAta: string;
    pregaoFormatado: string;
    uasg: string;
}