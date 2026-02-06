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
 * Estrutura simplificada e mapeada para uso no frontend.
 */
export interface ArpItemResult {
    id: string;
    numeroAta: string;
    objeto: string;
    uasg: string;
    omNome: string;
    dataVigenciaInicial: string;
    dataVigenciaFinal: string;
    valorTotalEstimado: number;
    quantidadeItens: number;
    pregaoFormatado: string;
}