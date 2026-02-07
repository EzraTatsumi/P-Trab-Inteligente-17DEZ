// Tipos para a consulta PNCP

export interface ArpUasgSearchParams {
    codigoUnidadeGerenciadora: string;
    dataVigenciaInicialMin: string;
    dataVigenciaInicialMax: string;
}

/**
 * Estrutura bruta de um item ARP retornado pela API externa (dentro da chave 'resultado').
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
}

/**
 * Estrutura simplificada e mapeada para uso no frontend (Resultado da busca inicial por UASG).
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
}

/**
 * Estrutura bruta de um item detalhado retornado pela API 2_consultarItemARP.
 */
export interface DetailedArpRawResult {
    idItem: string; // ID único do item
    codigoItem: string; // Código CATMAT/CATSER
    descricaoItem: string;
    unidadeMedida: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
    // Outros campos que podem ser úteis
    numeroAtaRegistroPreco: string;
    numeroCompra: string;
    anoCompra: string;
    codigoUnidadeGerenciadora: string;
}

/**
 * Estrutura simplificada e mapeada para uso no frontend (Item detalhado da ARP).
 */
export interface DetailedArpItem {
    id: string; // idItem
    codigoItem: string; // CATMAT/CATSER
    descricaoItem: string;
    unidadeMedida: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
    // Metadados de origem (para facilitar a importação)
    numeroAta: string;
    numeroCompra: string;
    anoCompra: string;
    uasg: string;
}