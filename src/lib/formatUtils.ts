/**
 * Formata um número para o formato de moeda brasileira (R$ X.XXX,XX).
 * @param value O valor numérico.
 * @returns A string formatada.
 */
export const formatCurrency = (value: number | string): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(num);
};

/**
 * Converte um valor de string de moeda (R$ X.XXX,XX) para um número bruto.
 * @param value A string de moeda.
 * @returns Um objeto contendo o valor numérico e a string formatada.
 */
export const formatCurrencyInput = (value: string): { numericValue: number, formattedValue: string } => {
    // Remove R$, pontos e substitui vírgula por ponto
    const rawValue = value.replace(/[R$\s.]/g, '').replace(',', '.');
    const numericValue = parseFloat(rawValue) / 100 || 0;

    const formattedValue = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(numericValue);

    return { numericValue, formattedValue };
};

/**
 * Retorna os dígitos brutos de um número para uso em inputs controlados.
 * Ex: 123.45 -> "12345"
 * @param value O valor numérico.
 * @returns A string de dígitos brutos.
 */
export const numberToRawDigits = (value: number | string): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return "";
    return (num * 100).toFixed(0);
};

/**
 * Formata um número decimal para o padrão brasileiro (vírgula).
 * @param value O valor numérico.
 * @param decimals Número de casas decimais a exibir.
 * @returns A string formatada.
 */
export const formatDecimal = (value: number | string, decimals: number = 2): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return "0,00";
    
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
};

/**
 * Formata um código UG (Unidade Gestora) para garantir 6 dígitos, preenchendo com zeros à esquerda.
 * @param codug O código UG como string ou número.
 * @returns O código UG formatado (string de 6 dígitos).
 */
export const formatCodug = (codug: string | number): string => {
    if (typeof codug === 'number') {
        return String(codug).padStart(6, '0');
    }
    if (typeof codug === 'string') {
        return codug.padStart(6, '0');
    }
    return '';
};