export const formatCurrency = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

export const formatNumber = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '0';
    return new Intl.NumberFormat('pt-BR', {
        maximumFractionDigits: 2,
    }).format(value);
};

/**
 * Formata uma string de entrada com separadores de milhar (ponto) e decimal (vírgula)
 * para uso em campos de input (padrão brasileiro).
 * @param value A string de entrada (ex: "12345,67").
 * @returns A string formatada (ex: "12.345,67").
 */
export const formatInputWithThousands = (value: string): string => {
    // 1. Remove todos os caracteres não-dígitos, exceto a vírgula
    let cleanedValue = value.replace(/[^\d,]/g, '');

    // 2. Garante que haja apenas uma vírgula (separador decimal)
    const parts = cleanedValue.split(',');
    if (parts.length > 2) {
        // Se houver múltiplas vírgulas, mantém a primeira e junta o resto
        cleanedValue = parts[0] + ',' + parts.slice(1).join('');
    }
    
    // Re-split após a limpeza
    const finalParts = cleanedValue.split(',');
    let integerPart = finalParts[0];
    const decimalPart = finalParts.length > 1 ? finalParts[1] : '';

    // 3. Formata a parte inteira com separador de milhar (ponto)
    // Remove zeros à esquerda (exceto se for apenas '0')
    if (integerPart.length > 1 && integerPart.startsWith('0')) {
        integerPart = integerPart.replace(/^0+/, '');
    }
    if (integerPart === '') integerPart = '0';

    // Aplica o separador de milhar (ponto)
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    // 4. Recombina
    let formattedValue = integerPart;
    if (finalParts.length > 1) {
        formattedValue += ',' + decimalPart;
    }

    return formattedValue;
};