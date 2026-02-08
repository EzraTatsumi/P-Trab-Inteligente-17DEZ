import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata um valor numérico para o formato de moeda brasileira (R$ X.XXX,XX).
 * @param value O valor numérico.
 * @returns String formatada.
 */
export const formatCurrency = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined) return 'R$ 0,00';
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numericValue)) return 'R$ 0,00';

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(numericValue);
};

/**
 * Formata um valor numérico para o formato de número brasileiro (X.XXX,XX).
 * @param value O valor numérico.
 * @param decimals Número de casas decimais (padrão: 2).
 * @returns String formatada.
 */
export const formatNumber = (value: number | string | null | undefined, decimals: number = 2): string => {
    if (value === null || value === undefined) return '0';
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numericValue)) return '0';

    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(numericValue);
};

/**
 * Converte uma string de entrada de moeda (ex: "1234,56") para um objeto contendo
 * o valor numérico e os dígitos brutos.
 * @param rawValue A string de entrada do usuário.
 * @returns { numericValue: number, digits: string }
 */
export const formatCurrencyInput = (rawValue: string): { numericValue: number, digits: string } => {
    // Remove tudo que não for dígito ou vírgula
    const cleanedValue = rawValue.replace(/[^\d,]/g, '');

    // Substitui a vírgula por ponto para conversão em float
    const floatString = cleanedValue.replace(',', '.');

    // Converte para número
    const numericValue = parseFloat(floatString) || 0;

    // Retorna os dígitos brutos (para manter o controle do input)
    const digits = cleanedValue.replace(/,/g, '');

    return { numericValue, digits };
};

/**
 * Converte um número para uma string de dígitos brutos (para inicializar CurrencyInput).
 * @param value O valor numérico.
 * @returns String de dígitos brutos.
 */
export const numberToRawDigits = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numericValue)) return '';

    // Multiplica por 100 para obter centavos e remove o ponto decimal
    return Math.round(numericValue * 100).toString();
};

/**
 * Formata uma string de 6 dígitos (UASG/UG) com um ponto de milhar (ex: 160001 -> 160.001).
 * @param codug A string de 6 dígitos.
 * @returns String formatada.
 */
export const formatCodug = (codug: string | number | null | undefined): string => {
    if (!codug) return '';
    const str = String(codug).replace(/\D/g, '');
    if (str.length !== 6) return str;
    return `${str.substring(0, 3)}.${str.substring(3)}`;
};

/**
 * Formata uma data ISO (YYYY-MM-DD) para o formato DD/MM/YYYY.
 * @param dateString A string da data.
 * @returns String formatada.
 */
export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString + 'T00:00:00'); // Adiciona T00:00:00 para evitar problemas de fuso horário
        return format(date, 'dd/MM/yyyy', { locale: ptBR });
    } catch (e) {
        return dateString;
    }
};

/**
 * Formata o número do pregão para exibição, removendo zeros à esquerda e adicionando separadores.
 * Se for uma referência não numérica (como 'Em processo de abertura'), retorna a string original.
 * @param pregao O número ou referência do pregão.
 * @returns String formatada.
 */
export const formatPregaoDisplay = (pregao: string | null | undefined): string => {
    if (!pregao) return 'N/A';
    
    const trimmedPregao = pregao.trim();
    
    // Se contiver caracteres não numéricos além de ponto ou barra, retorna a string original
    if (/[^\d./-]/.test(trimmedPregao)) {
        return trimmedPregao;
    }
    
    // Tenta formatar como número/ano (Ex: 90001/24)
    const parts = trimmedPregao.split('/');
    
    if (parts.length === 2) {
        const numberPart = parts[0].replace(/^0+/, ''); // Remove zeros à esquerda
        const yearPart = parts[1];
        
        // Adiciona ponto de milhar na parte numérica, se aplicável
        const formattedNumberPart = numberPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        
        return `${formattedNumberPart}/${yearPart}`;
    }
    
    // Se for apenas um número, remove zeros à esquerda e adiciona ponto de milhar
    const numericOnly = trimmedPregao.replace(/\D/g, '');
    if (numericOnly.length > 0) {
        const numberWithoutLeadingZeros = numericOnly.replace(/^0+/, '');
        return numberWithoutLeadingZeros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    return trimmedPregao;
};