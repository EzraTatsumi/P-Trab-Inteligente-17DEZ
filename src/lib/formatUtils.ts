import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formats a number as currency (BRL).
 * @param value The numeric value.
 * @returns Formatted string (e.g., R$ 1.234,56).
 */
export const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return 'R$ 0,00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
};

/**
 * Formats a number with thousand separators.
 * @param value The numeric value.
 * @returns Formatted string (e.g., 1.234).
 */
export const formatNumber = (value: number | string | null | undefined, decimals: number = 0): string => {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

/**
 * Parses a string input (allowing comma as decimal separator) into a number.
 * Handles optional thousand separators (dots) by removing them.
 */
export const parseInputToNumber = (input: string | number | null | undefined): number => {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') return input;
  
  // Ensure input is treated as a string for replacement operations
  const stringInput = String(input); 
  
  // 1. Remove dots (thousand separators)
  // 2. Replace comma (decimal separator) with dot
  const cleaned = stringInput.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

/**
 * Formats a number for display in an input field using the Brazilian standard (comma for decimal).
 * Ensures a minimum number of fraction digits.
 */
export const formatNumberForInput = (num: number | string | null | undefined, minFractionDigits: number = 2): string => {
  if (num === undefined || num === null) return "";
  const numericValue = typeof num === 'string' ? parseFloat(num) : num;
  
  if (isNaN(numericValue) || numericValue === 0) return ""; // Retorna string vazia se for zero ou NaN
  
  // Use Intl.NumberFormat para formatar com o separador decimal (vírgula)
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: minFractionDigits,
    useGrouping: false, // Não usa separador de milhar
  }).format(numericValue);
};

/**
 * Cleans a raw string input, allowing only digits, dots (for thousands), and one comma (for decimal).
 * This version is designed to be permissive during typing.
 */
export const formatInputWithThousands = (value: string | undefined | null): string => {
  // FIX: Ensure value is treated as a string, defaulting to empty string if null or undefined
  const stringValue = String(value || '');
  
  // 1. Remove tudo exceto dígitos, ponto e vírgula
  let cleaned = stringValue.replace(/[^\d,.]/g, '');

  // 2. Garante que haja apenas uma vírgula (decimal separator)
  const parts = cleaned.split(',');
  if (parts.length > 2) {
    // Se houver mais de uma vírgula, mantém apenas a primeira
    cleaned = parts[0] + ',' + parts.slice(1).join('');
  }
  
  // 3. Remove pontos que não estejam na posição correta de milhar (simplificado para ser mais permissivo)
  // Para inputs de valor, vamos apenas remover todos os pontos para evitar confusão durante a digitação.
  
  // Se houver vírgula, remove todos os pontos da parte inteira
  if (cleaned.includes(',')) {
    const [integerPart, decimalPart] = cleaned.split(',');
    const cleanInteger = integerPart.replace(/\./g, '');
    
    // Limita a parte decimal a 4 dígitos (para consumo)
    const limitedDecimal = decimalPart.substring(0, 4); 
    
    return `${cleanInteger}${limitedDecimal ? `,${limitedDecimal}` : ''}`;
  }
  
  // Se não houver vírgula, remove todos os pontos
  return cleaned.replace(/\./g, '');
};

/**
 * Converts a numeric value (e.g., 9.00) into a raw string of digits (e.g., "900") 
 * suitable for the formatCurrencyInput masking function.
 */
export const numberToRawDigits = (num: number | undefined | null): string => {
  if (num === undefined || num === null || isNaN(num)) return "";
  // Multiply by 100, round to handle floating point issues, convert to string
  return String(Math.round(num * 100));
};


/**
 * Formats a string de dígitos para o formato monetário brasileiro (preenchimento da direita).
 * Ex: "1" -> "0,01", "12" -> "0,12", "123" -> "1,23"
 * @param value String contendo apenas dígitos.
 * @returns { formatted: string, numericValue: number, digits: string } String formatada com vírgula e ponto de milhar, valor numérico e dígitos brutos.
 */
export const formatCurrencyInput = (value: string | undefined | null): { formatted: string, numericValue: number, digits: string } => {
  // FIX: Ensure value is treated as a string, defaulting to empty string if null or undefined
  const stringValue = String(value || '');
  
  // 1. Remove tudo que não for dígito
  const digits = stringValue.replace(/\D/g, '');

  if (digits.length === 0) {
    return { formatted: "", numericValue: 0, digits: "" };
  }

  // 2. Trata como centavos (ex: "12345" -> 123.45)
  const numericValue = parseInt(digits) / 100;

  // 3. Formata para exibição (R$ 123.456,78)
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);

  return { formatted, numericValue, digits };
};

/**
 * Calculates the start (Monday) and end (Friday) dates of the previous week.
 * @returns { start: string, end: string } Dates in YYYY-MM-DD format.
 */
export const getPreviousWeekRange = (): { start: string, end: string } => {
  const now = new Date();
  // Subtrai uma semana
  const previousWeek = subWeeks(now, 1);
  
  // Encontra a segunda-feira da semana anterior (startOfWeek usa 1 para Monday por padrão em ptBR)
  const monday = startOfWeek(previousWeek, { locale: ptBR, weekStartsOn: 1 });
  
  // Encontra a sexta-feira da semana anterior
  // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  const friday = endOfWeek(monday, { locale: ptBR, weekStartsOn: 1 });
  friday.setDate(friday.getDate() - 1); // Move do domingo para a sexta-feira
  
  return {
    start: format(monday, 'yyyy-MM-dd'),
    end: format(friday, 'yyyy-MM-dd'),
  };
};

/**
 * Formats a date string into DDMMMAA format (e.g., 25NOV24).
 * @param dateString The date string or Date object.
 * @returns Formatted date string.
 */
export const formatDateDDMMMAA = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  // Use date-fns format: dd (day), MMM (short month name in Portuguese), yy (short year)
  return format(date, 'ddMMMyy', { locale: ptBR }).toUpperCase();
};

/**
 * Formats a military UG code (usually 6 digits) into XXX.XXX format.
 * If the input is not a 6-digit string, it returns the original input.
 * @param ug The UG code string.
 * @returns Formatted string (e.g., 123.456).
 */
export const formatUgNumber = (ug: string | null | undefined): string => {
  if (!ug) return '';
  const cleanedUg = ug.replace(/\D/g, ''); // Remove non-digits
  
  if (cleanedUg.length === 6) {
    return `${cleanedUg.substring(0, 3)}.${cleanedUg.substring(3, 6)}`;
  }
  
  return ug;
};