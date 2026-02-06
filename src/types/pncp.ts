// Tipos para a consulta PNCP

export interface ArpUasgSearchParams {
    codigoUnidadeGerenciadora: string;
    dataVigenciaInicialMin: string;
    dataVigenciaInicialMax: string;
}

/**
 * Estrutura simplificada de um item ARP retornado pela API externa.
 * Os nomes dos campos são mapeados para o que é esperado no frontend.
 */
export interface ArpItemResult {
    id: string; // ID da ARP (pode ser o código da ata)
    numeroAta: string;
    objeto: string;
    uasg: string;
    dataVigenciaInicial: string;
    dataVigenciaFinal: string;
    valorTotalEstimado: number;
    quantidadeItens: number;
}