import { subWeeks, startOfWeek, endOfWeek, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Calcula a diferença em dias entre duas datas.
 * @param inicio Data de início (string ISO ou Date).
 * @param fim Data de fim (string ISO ou Date).
 * @returns O número de dias (inclusivo).
 */
export const calculateDays = (inicio: string | Date, fim: string | Date): number => {
  const start = new Date(inicio);
  const end = new Date(fim);
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
};

/**
 * Formata um número ou string de 6 dígitos (CODUG) para o formato XXX.XXX.
 * Se o valor não for uma string de 6 dígitos, retorna o valor original.
 * @param codug O código da UG (Unidade Gestora).
 * @returns O CODUG formatado (ex: 123.456) ou a string original.
 */
export const formatCodug = (codug: string | number | null | undefined): string => {
    if (codug === null || codug === undefined) {
        return '';
    }
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
    if (value === null || value === undefined) {
        return '0';
    }
    
    const options: Intl.NumberFormatOptions = {
        maximumFractionDigits: decimals,
    };
    
    // Se o número de casas decimais for 2, garante que 2 casas sejam exibidas (ex: 7.00)
    if (decimals === 2) {
        options.minimumFractionDigits = 2;
    } else {
        options.minimumFractionDigits = 0;
    }
    
    return new Intl.NumberFormat('pt-BR', options).format(value);
};

/**
 * Formata uma data ISO para o formato DD/MM/AAAA.
 * @param dateString A string de data ISO.
 * @returns A string de data formatada.
 */
export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
        // Usando date-fns para formatação consistente
        return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch (e) {
        return dateString || '';
    }
};

/**
 * Formata uma data ISO para o formato DDMMMAA (ex: 25DEZ24).
 * @param dateString A string de data ISO.
 * @returns A string de data formatada sem barras.
 */
export const formatDateDDMMMAA = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const day = date.getUTCDate().toString().padStart(2, '0');
        const month = date.toLocaleString('pt-BR', { month: 'short', timeZone: 'UTC' }).toUpperCase().replace('.', '');
        const year = date.getUTCFullYear().toString().slice(-2);
        // Retorna a string sem as barras
        return `${day}${month}${year}`;
    } catch (e) {
        return dateString;
    }
};

/**
 * Calculates the date range for the previous week (Sunday to Saturday).
 * @returns An object containing the start and end dates as ISO strings.
 */
export const getPreviousWeekRange = (): { start: string, end: string } => {
    const now = new Date();
    // Go back one week
    const previousWeek = subWeeks(now, 1);
    
    // Start of the week (Sunday, locale 0)
    const start = startOfWeek(previousWeek, { weekStartsOn: 0 }); 
    
    // End of the week (Saturday)
    const end = endOfWeek(previousWeek, { weekStartsOn: 0 });
    
    // Return as ISO strings
    return {
        start: start.toISOString(),
        end: end.toISOString(),
    };
};

// --- Funções de Formatação de Input ---

/**
 * Converte uma string de entrada formatada (ex: "1.234,56") para um número.
 * @param inputString A string de entrada formatada.
 * @returns O valor numérico.
 */
export const parseInputToNumber = (inputString: string): number => {
    if (!inputString) return 0;
    // Remove pontos de milhar e substitui vírgula decimal por ponto
    const cleanedString = String(inputString).replace(/\./g, '').replace(',', '.');
    const number = parseFloat(cleanedString);
    return isNaN(number) ? 0 : number;
};

/**
 * Formata um número para exibição em inputs, usando separador de milhar (ponto) e decimal (vírgula).
 * @param value O valor numérico.
 * @param decimals Número de casas decimais.
 * @returns A string formatada.
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
 * Formata uma string de dígitos brutos (ex: "123456") para o formato monetário brasileiro.
 * @param rawDigits String contendo apenas dígitos (centavos).
 * @returns Objeto com a string formatada e o valor numérico.
 */
export const formatCurrencyInput = (rawDigits: string | null | undefined): { formatted: string, numericValue: number, digits: string } => {
    // Garante que rawDigits é uma string antes de usar replace
    const inputString = String(rawDigits || '');
    
    // Remove tudo que não for dígito
    const digits = inputString.replace(/\D/g, '');
    
    if (digits.length === 0) {
        return { formatted: '', numericValue: 0, digits: '' };
    }

    // Converte para centavos e depois para reais
    const numericValue = parseInt(digits, 10) / 100;

    // Formata para exibição (ex: 1.234,56)
    const formatted = numericValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return { formatted, numericValue, digits };
};

/**
 * Formata um número para o formato de entrada com separador de milhar.
 * @param value O valor numérico.
 * @returns A string formatada.
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
 * @param value O valor numérico.
 * @returns A string de dígitos.
 */
export const numberToRawDigits = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
        return '';
    }
    // Multiplica por 100 e arredonda para evitar problemas de ponto flutuante
    return String(Math.round(value * 100));
};

/**
 * Formata um número de Pregão no padrão X.XXX/AA, removendo zeros à esquerda do número principal.
 * Espera o formato '000.001/24' e retorna '1/24' ou '1.001/24'.
 * @param pregaoFormatado O pregão formatado (ex: '000.001/24').
 * @returns String formatada (ex: '1/24').
 */
export function formatPregao(pregaoFormatado: string): string {
    if (!pregaoFormatado || pregaoFormatado === 'N/A') return 'N/A';

    // Verifica se é uma referência de preço médio (que não tem formato de pregão)
    if (pregaoFormatado.toLowerCase().includes('ref. preço') || pregaoFormatado.toLowerCase().includes('em processo')) {
        return pregaoFormatado;
    }

    // Remove o ano e o separador (/) temporariamente
    const parts = pregaoFormatado.split('/');
    if (parts.length !== 2) return pregaoFormatado;

    // Remove pontos de milhar e zeros à esquerda do número
    const numeroCompleto = parts[0].replace(/\./g, '').replace(/^0+/, ''); 
    const ano = parts[1]; 

    if (!numeroCompleto) {
        // Caso o número seja '0' ou vazio, retorna '0/AA'
        return `0/${ano}`;
    }

    // Reinsere o ponto de milhar, se necessário (a cada 3 dígitos a partir da direita)
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
 * @param str A string de entrada.
 * @returns A string com a primeira letra em maiúsculo.
 */
export function capitalizeFirstLetter(str: string | null | undefined): string {
    if (!str) return '';
    const trimmedStr = str.trim();
    if (trimmedStr.length === 0) return '';
    return trimmedStr.charAt(0).toUpperCase() + trimmedStr.slice(1);
}