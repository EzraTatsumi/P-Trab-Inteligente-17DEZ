import { subWeeks, startOfWeek, endOfWeek, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata um número ou string de 6 dígitos (CODUG) para o formato XXX.XXX.
 * @param codug O código da UG (Unidade Gestora).
 * @returns O CODUG formatado (ex: 123.456) ou a string original.
 */
export const formatCodug = (codug: any): string => {
    if (codug === null || codug === undefined || codug === '') {
        return '';
    }
    
    // Converte para string e remove espaços
    const strCodug = String(codug).trim();
    
    // Verifica se a string tem 6 caracteres e contém apenas dígitos
    if (strCodug.length === 6 && /^\d+$/.test(strCodug)) {
        return `${strCodug.substring(0, 3)}.${strCodug.substring(3)}`;
    }
    
    // Se já estiver formatado (ex: 123.456), retorna como está
    if (strCodug.length === 7 && /^\d{3}\.\d{3}$/.test(strCodug)) {
        return strCodug;
    }

    // Caso contrário, retorna a string original
    return strCodug;
};

/**
 * Formata um valor numérico para o padrão monetário brasileiro (R$ X.XXX,XX).
 * @param value O valor numérico.
 * @returns A string formatada.
 */
export const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) {
        return 'R$ 0,00';
    }
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

/**
 * Formata um número para o padrão brasileiro (X.XXX,XX).
 * @param value O valor numérico.
 * @param decimals O número máximo de casas decimais (padrão: 2).
 * @returns A string formatada.
 */
export const formatNumber = (value: number | null | undefined, decimals: number = 2): string => {
    if (value === null || value === undefined || isNaN(Number(value))) {
        return '0';
    }
    
    const numValue = Number(value);
    const options: Intl.NumberFormatOptions = {
        maximumFractionDigits: decimals,
    };
    
    // Se o número de casas decimais for 2, garante que 2 casas sejam exibidas (ex: 7.00)
    if (decimals === 2) {
        options.minimumFractionDigits = 2;
    } else {
        options.minimumFractionDigits = 0;
    }
    
    return new Intl.NumberFormat('pt-BR', options).format(numValue);
};

/**
 * Formata uma data ISO para o formato DD/MM/AAAA.
 * @param dateString A string de data ISO.
 * @returns A string de data formatada.
 */
export const formatDate = (dateString: any): string => {
    if (!dateString) return '';
    try {
        return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch (e) {
        return String(dateString) || '';
    }
};

/**
 * Formata uma data ISO para o formato DDMMMAA (ex: 25DEZ24).
 * @param dateString A string de data ISO.
 * @returns A string de data formatada sem barras.
 */
export const formatDateDDMMMAA = (dateString: any): string => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const day = date.getUTCDate().toString().padStart(2, '0');
        const month = date.toLocaleString('pt-BR', { month: 'short', timeZone: 'UTC' }).toUpperCase().replace('.', '');
        const year = date.getUTCFullYear().toString().slice(-2);
        return `${day}${month}${year}`;
    } catch (e) {
        return String(dateString);
    }
};

/**
 * Calcula o intervalo de datas da semana anterior.
 */
export const getPreviousWeekRange = (): { start: string, end: string } => {
    const now = new Date();
    const previousWeek = subWeeks(now, 1);
    const start = startOfWeek(previousWeek, { weekStartsOn: 0 }); 
    const end = endOfWeek(previousWeek, { weekStartsOn: 0 });
    return {
        start: start.toISOString(),
        end: end.toISOString(),
    };
};

/**
 * Converte uma string de entrada formatada para um número.
 */
export const parseInputToNumber = (inputString: string): number => {
    if (!inputString) return 0;
    const cleanedString = String(inputString).replace(/\./g, '').replace(',', '.');
    const number = parseFloat(cleanedString);
    return isNaN(number) ? 0 : number;
};

/**
 * Formata um número para exibição em inputs.
 */
export const formatNumberForInput = (value: number | null | undefined, decimals: number = 2): string => {
    if (value === null || value === undefined || isNaN(value)) {
        return '';
    }
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

/**
 * Formata uma string de dígitos brutos para o formato monetário brasileiro.
 */
export const formatCurrencyInput = (rawDigits: any): { formatted: string, numericValue: number, digits: string } => {
    const inputString = String(rawDigits || '');
    const digits = inputString.replace(/\D/g, '');
    
    if (digits.length === 0) {
        return { formatted: '', numericValue: 0, digits: '' };
    }

    const numericValue = parseInt(digits, 10) / 100;
    const formatted = numericValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return { formatted, numericValue, digits };
};

/**
 * Formata um número para o formato de entrada com separador de milhar.
 */
export const formatInputWithThousands = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
        return '';
    }
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
};

/**
 * Converte um número para uma string de dígitos brutos (centavos).
 */
export const numberToRawDigits = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
        return '';
    }
    return String(Math.round(value * 100));
};

/**
 * Formata um número de Pregão no padrão X.XXX/AA.
 * @param pregaoFormatado O pregão formatado (ex: '000.001/24').
 * @returns String formatada (ex: '1/24').
 */
export function formatPregao(pregaoFormatado: any): string {
    if (!pregaoFormatado || pregaoFormatado === 'N/A') return 'N/A';

    const strPregao = String(pregaoFormatado);

    if (strPregao.toLowerCase().includes('ref. preço') || strPregao.toLowerCase().includes('em processo')) {
        return strPregao;
    }

    const parts = strPregao.split('/');
    if (parts.length !== 2) return strPregao;

    const numeroCompleto = parts[0].replace(/\./g, '').replace(/^0+/, ''); 
    const ano = parts[1]; 

    if (!numeroCompleto) {
        return `0/${ano}`;
    }

    let formattedNumber = '';
    let tempNumber = numeroCompleto;
    
    while (tempNumber.length > 3) {
        formattedNumber = `.${tempNumber.slice(-3)}${formattedNumber}`;
        tempNumber = tempNumber.slice(0, -3);
    }
    formattedNumber = tempNumber + formattedNumber;

    return `${formattedNumber}/${ano}`;
}

/**
 * Capitaliza a primeira letra de uma string.
 */
export function capitalizeFirstLetter(str: string | null | undefined): string {
    if (!str) return '';
    const trimmedStr = str.trim();
    if (trimmedStr.length === 0) return '';
    return trimmedStr.charAt(0).toUpperCase() + trimmedStr.slice(1);
}