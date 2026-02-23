export interface ArpUasgSearchParams {
    uasg: string;
}

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
    numeroControlePncpAta: string;
}

export interface ArpRawResult {
    idCompra: string;
    numeroAtaRegistroPreco: string;
    objeto: string;
    codigoUnidadeGerenciadora: string;
    nomeUnidadeGerenciadora: string;
    dataVigenciaInicial: string;
    dataVigenciaFinal: string;
    valorTotal: number;
    quantidadeItens: number;
    numeroCompra: string;
    anoCompra: string;
    numeroControlePncpAta: string;
}

export interface DetailedArpItem {
    id: string;
    numeroAta: string;
    codigoItem: string;
    descricaoItem: string;
    valorUnitario: number;
    quantidadeHomologada: number;
    numeroControlePncpAta: string;
    pregaoFormatado: string;
    uasg: string;
    omNome: string;
    dataVigenciaInicial: string;
    dataVigenciaFinal: string;
}

export interface DetailedArpRawResult {
    numeroControlePncpAta: string;
    numeroItem: number;
    numeroAtaRegistroPreco: string;
    codigoItem: string;
    descricaoItem: string;
    valorUnitario: number;
    quantidadeHomologadaItem: number;
    numeroCompra: string;
    anoCompra: string;
    codigoUnidadeGerenciadora: string;
    nomeUnidadeGerenciadora: string;
    dataVigenciaInicial: string;
    dataVigenciaFinal: string;
}

export interface CatmatDetailsRawResult {
    descricaoItem: string;
    nomePdm: string;
}

export interface PriceStatsSearchParams {
    codigoItem: string;
    dataInicio: string | null;
    dataFim: string | null;
}

export interface RawPriceRecord {
    codigoUasg: string;
    nomeUasg: string;
    precoUnitario: number;
}

export interface PriceStats {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    medianPrice: number;
}

export interface PriceStatsResult {
    codigoItem: string;
    descricaoItem: string;
    totalRegistros: number;
    stats: PriceStats;
    rawRecords: RawPriceRecord[];
}