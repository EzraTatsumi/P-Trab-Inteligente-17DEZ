import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata um valor numérico para a moeda brasileira (R$).
 * @param value O valor numérico.
 * @returns String formatada como R$ X.XXX,XX.
 */
export const formatCurrency = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined) return 'R$ 0,00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'R$ 0,00';

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(num);
};

/**
 * Converte uma string de input de moeda (R$ X.XXX,XX) para um objeto com o valor numérico e os dígitos brutos.
 * @param rawValue A string de input.
 * @returns Objeto com numericValue (number) e digits (string).
 */
export const formatCurrencyInput = (rawValue: string): { numericValue: number, digits: string } => {
    // Remove tudo que não for dígito ou vírgula
    const cleaned = rawValue.replace(/[^\d,]/g, '');
    
    // Substitui a vírgula por ponto para conversão para float
    const numericString = cleaned.replace(',', '.');
    
    // Encontra a posição da vírgula (ou ponto)
    const decimalIndex = cleaned.indexOf(',');
    
    let digits = cleaned.replace(/,/g, '');
    let numericValue = parseFloat(numericString) || 0;

    // Se houver vírgula, ajusta os dígitos para manter a precisão de 2 casas
    if (decimalIndex !== -1) {
        const integerPart = digits.slice(0, decimalIndex);
        const decimalPart = digits.slice(decimalIndex).padEnd(2, '0').slice(0, 2);
        digits = integerPart + decimalPart;
        numericValue = parseFloat(digits) / 100;
    } else if (digits.length > 2) {
        // Se não houver vírgula, mas houver mais de 2 dígitos, assume que os últimos 2 são decimais
        numericValue = parseFloat(digits) / 100;
    } else if (digits.length > 0) {
        // Se houver 1 ou 2 dígitos, trata como centavos
        numericValue = parseFloat(digits) / 100;
    }
    
    return { numericValue, digits };
};

/**
 * Converte um número para uma string contendo apenas os dígitos (incluindo centavos).
 * Ex: 123.45 -> "12345"
 */
export const numberToRawDigits = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return "";
    
    // Multiplica por 100 e arredonda para evitar problemas de ponto flutuante
    const raw = Math.round(value * 100).toString();
    return raw;
};

/**
 * Formata um código UG (Unidade Gestora) para o formato XXX.XXX.
 * @param codug O código UG como string.
 * @returns String formatada como XXX.XXX.
 */
export const formatCodug = (codug: string | null | undefined): string => {
    if (!codug) return '';
    const cleaned = codug.replace(/\D/g, '');
    if (cleaned.length !== 6) return codug;
    return `${cleaned.substring(0, 3)}.${cleaned.substring(3, 6)}`;
};

/**
 * Formata uma data ISO para o formato DD/MM/AAAA.
 * @param dateString A string de data ISO.
 * @returns String formatada.
 */
export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
        const date = parseISO(dateString);
        return format(date, 'dd/MM/yyyy', { locale: ptBR });
    } catch (e) {
        return dateString;
    }
};

/**
 * Formata um número decimal usando vírgula como separador decimal.
 * @param value O valor numérico.
 * @param precision Número de casas decimais (padrão 2).
 * @returns String formatada.
 */
export const formatDecimal = (value: number | string | null | undefined, precision: number = 2): string => {
    if (value === null || value === undefined) return '0,00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0,00';

    return num.toLocaleString('pt-BR', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
    });
};