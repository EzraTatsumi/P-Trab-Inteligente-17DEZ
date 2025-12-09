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
 * Converte uma string formatada (ponto como milhar, vírgula como decimal) para um número.
 * @param input A string de entrada (ex: "12.345,67").
 * @returns O valor numérico.
 */
export const parseInputToNumber = (input: string): number => {
    // Remove pontos (separador de milhar) e substitui vírgula (separador decimal) por ponto
    const cleaned = input.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
};

/**
 * Formata um número para uma string adequada para inputs (padrão pt-BR, com vírgula decimal).
 * @param num O valor numérico.
 * @param decimals Número de casas decimais.
 * @returns A string formatada (ex: "12.345,67").
 */
export const formatNumberForInput = (num: number | string | undefined | null, decimals: number = 2): string => {
    if (num === undefined || num === null || num === "") return "";
    
    const numericValue = typeof num === 'string' ? parseInputToNumber(num) : num;
    
    if (isNaN(numericValue) || numericValue === 0) {
        return "";
    }
    
    // Usa Intl.NumberFormat para formatar com separador de milhar (ponto) e decimal (vírgula)
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(numericValue);
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

/**
 * Formata uma string de dígitos para o formato de moeda (R$ X.XXX,XX) para inputs mascarados.
 * Retorna o valor numérico e a string de dígitos limpa.
 * @param digits String contendo apenas dígitos (centavos).
 */
export const formatCurrencyInput = (digits: string): { formatted: string, numericValue: number, digits: string } => {
    // 1. Garante que apenas dígitos sejam mantidos
    const cleanedDigits = digits.replace(/\D/g, '');
    
    if (cleanedDigits.length === 0) {
        return { formatted: "", numericValue: 0, digits: "" };
    }

    // 2. Padroniza para ter pelo menos 3 dígitos (para incluir R$ 0,0X)
    const paddedDigits = cleanedDigits.padStart(3, '0');
    
    // 3. Separa a parte inteira e decimal
    const integerPart = paddedDigits.slice(0, -2);
    const decimalPart = paddedDigits.slice(-2);
    
    // 4. Formata a parte inteira com separador de milhar (ponto)
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    const formatted = `${formattedInteger},${decimalPart}`;
    
    // 5. Calcula o valor numérico (R$ 123,45 -> 123.45)
    const numericValue = parseFloat(`${integerPart}.${decimalPart}`);

    return { formatted, numericValue: numericValue / 100, digits: cleanedDigits };
};