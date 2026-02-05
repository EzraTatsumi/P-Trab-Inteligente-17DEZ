/**
 * Converte um valor de moeda formatado (string) para um número bruto (number).
 * @param formattedValue - O valor formatado (ex: '1.234,56').
 * @returns O valor numérico (ex: 1234.56).
 */
export const parseInputToNumber = (formattedValue: string): number => {
    if (!formattedValue) return 0;
    // Remove pontos de milhar e substitui vírgula decimal por ponto
    const cleaned = formattedValue.replace(/\./g, '').replace(/,/g, '.');
    const numericValue = parseFloat(cleaned);
    return isNaN(numericValue) ? 0 : numericValue;
};

/**
 * Formata um número para o formato de moeda brasileiro (R$ X.XXX,XX).
 * @param value - O valor numérico.
 * @returns A string formatada.
 */
export const formatCurrency = (value: number): string => {
    if (typeof value !== 'number' || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

/**
 * Formata um número para o formato brasileiro (X.XXX,XX) sem o símbolo de moeda.
 * @param value - O valor numérico.
 * @param decimals - Número de casas decimais (padrão: 2).
 * @returns A string formatada.
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
    if (typeof value !== 'number' || isNaN(value)) return '0,00';
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
};

/**
 * Extrai apenas os dígitos de uma string de entrada de moeda.
 * @param rawValue - A string de entrada (pode conter formatação).
 * @returns A string contendo apenas dígitos.
 */
export const numberToRawDigits = (value: number): string => {
    if (typeof value !== 'number' || isNaN(value)) return '';
    return (value * 100).toFixed(0);
};

/**
 * Formata a entrada de moeda para exibição no CurrencyInput.
 * @param rawDigits - String contendo apenas dígitos (centavos).
 * @returns Objeto com o valor numérico e a string formatada.
 */
export const formatCurrencyInput = (rawDigits: string): { numericValue: number, digits: string, formatted: string } => {
    const digits = rawDigits.replace(/\D/g, '');
    if (digits === '') {
        return { numericValue: 0, digits: '', formatted: '' };
    }

    const numericValue = parseInt(digits, 10) / 100;
    
    const formatted = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(numericValue);

    return { numericValue, digits, formatted };
};

/**
 * Formata um código de Unidade Gestora (UASG) para o padrão XXXXXX.
 * Se o código tiver menos de 6 dígitos, preenche com zeros à esquerda.
 * @param codug - O código da UG como string.
 * @returns O código formatado.
 */
export const formatCodug = (codug: string | number | null | undefined): string => {
    if (codug === null || codug === undefined) return '';
    const strCodug = String(codug).replace(/\D/g, ''); // Remove não-dígitos
    return strCodug.padStart(6, '0');
};