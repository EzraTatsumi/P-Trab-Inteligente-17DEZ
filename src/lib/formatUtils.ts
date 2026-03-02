import { subWeeks, startOfWeek, endOfWeek, format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Calcula a diferença em dias entre duas datas.
 */
export const calculateDays = (inicio: string | Date, fim: string | Date): number => {
  if (!inicio || !fim) return 0;
  try {
    const start = typeof inicio === 'string' ? parseISO(inicio) : inicio;
    const end = typeof fim === 'string' ? parseISO(fim) : fim;
    return differenceInDays(end, start) + 1;
  } catch (e) {
    return 0;
  }
};

/**
 * Formata um número ou string de 6 dígitos (CODUG) para o formato XXX.XXX.
 */
export const formatCodug = (codug: string | number | null | undefined): string => {
    if (codug === null || codug === undefined) return '';
    const strCodug = String(codug).trim();
    
    if (strCodug.length === 6 && /^\d+$/.test(strCodug)) {
        return `${strCodug.substring(0, 3)}.${strCodug.substring(3)}`;
    }
    
    if (strCodug.length === 7 && /^\d{3}\.\d{3}$/.test(strCodug)) {
        return strCodug;
    }

    return strCodug;
};

/**
 * Alias para formatCodug para semântica de UASG.
 */
export const formatUasg = formatCodug;

/**
 * Formata um valor numérico para o padrão monetário brasileiro (R$ X.XXX,XX).
 */
export const formatCurrency = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === "") return 'R$ 0,00';
    const val = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(val);
};

/**
 * Formata um número para o padrão brasileiro (X.XXX,XX).
 */
export const formatNumber = (value: number | string | null | undefined, decimals: number = 2): string => {
    if (value === null || value === undefined || value === "") return '0';
    const val = typeof value === "string" ? parseFloat(value) : value;
    
    const options: Intl.NumberFormatOptions = {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals === 2 ? 2 : 0,
    };
    
    return new Intl.NumberFormat('pt-BR', options).format(val);
};

/**
 * Formata uma data ISO para o formato DD/MM/AAAA.
 */
export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
        return format(parseISO(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch (e) {
        return dateString || '';
    }
};

/**
 * Formata uma data ISO para o formato DDMMMAA (ex: 25DEZ24).
 */
export const formatDateDDMMMAA = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
        const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
        const day = format(date, 'dd', { locale: ptBR });
        const month = format(date, 'MMM', { locale: ptBR }).toUpperCase().replace('.', '');
        const year = format(date, 'yy', { locale: ptBR });
        return `${day}${month}${year}`;
    } catch (e) {
        return dateString;
    }
};

/**
 * Retorna o intervalo da semana anterior.
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
 * Converte uma string formatada para número.
 */
export const parseInputToNumber = (inputString: string): number => {
    if (!inputString) return 0;
    const cleanedString = String(inputString).replace(/\./g, '').replace(',', '.');
    const number = parseFloat(cleanedString);
    return isNaN(number) ? 0 : number;
};

/**
 * Formata um número para inputs brasileiros.
 */
export const formatNumberForInput = (value: number | null | undefined, decimals: number = 2): string => {
    if (value === null || value === undefined || isNaN(value)) return '';
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

/**
 * Formata dígitos brutos para entrada monetária.
 */
export const formatCurrencyInput = (rawDigits: string | null | undefined): { formatted: string, numericValue: number, digits: string } => {
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
 * Formata número com separador de milhar para inputs.
 */
export const formatInputWithThousands = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return '';
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
};

/**
 * Converte número para dígitos de centavos.
 */
export const numberToRawDigits = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === "") return '';
    const val = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(val)) return '';
    return String(Math.round(val * 100));
};

/**
 * Formata número de Pregão.
 */
export function formatPregao(pregaoFormatado: string | null | undefined): string {
    if (!pregaoFormatado || pregaoFormatado === 'N/A') return 'N/A';

    if (pregaoFormatado.toLowerCase().includes('ref. preço') || pregaoFormatado.toLowerCase().includes('em processo')) {
        return pregaoFormatado;
    }

    const parts = pregaoFormatado.split('/');
    if (parts.length !== 2) return pregaoFormatado;

    const numeroCompleto = parts[0].replace(/\./g, '').replace(/^0+/, ''); 
    const ano = parts[1]; 

    if (!numeroCompleto) return `0/${ano}`;

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
 * Capitaliza primeira letra.
 */
export function capitalizeFirstLetter(str: string | null | undefined): string {
    if (!str) return '';
    const trimmedStr = str.trim();
    if (trimmedStr.length === 0) return '';
    return trimmedStr.charAt(0).toUpperCase() + trimmedStr.slice(1);
}

/**
 * Formata fases para texto.
 */
export const formatFasesParaTexto = (fases: string | string[] | null | undefined): string => {
    if (!fases) return 'Não especificada';
    if (Array.isArray(fases)) {
        return fases.length > 0 ? fases.join(', ') : 'Não especificada';
    }
    return fases;
};