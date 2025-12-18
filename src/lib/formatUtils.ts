import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const formatNumber = (value: number, decimals: number = 0): string => {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Parses a string input (allowing comma as decimal separator) into a number.
 * Handles optional thousand separators (dots) by removing them.
 */
export const parseInputToNumber = (input: string): number => {
  // 1. Remove dots (thousand separators)
  // 2. Replace comma (decimal separator) with dot
  const cleaned = input.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

/**
 * Formats a number for display in an input field using the Brazilian standard (comma for decimal).
 * Ensures a minimum number of fraction digits.
 */
export const formatNumberForInput = (num: number, minFractionDigits: number = 2): string => {
  if (num === 0) return ""; // Retorna string vazia se for zero
  
  // Use Intl.NumberFormat to format with thousand separator (dot) and decimal separator (comma)
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: minFractionDigits,
  }).format(num);
};

/**
 * Cleans a raw string input (allowing comma as decimal separator) and removes thousand separators.
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
  // A formatação de milhar será aplicada apenas no blur.
  
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
 * Formata uma string de dígitos para o formato monetário brasileiro (preenchimento da direita).
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
 * Formats a date string into DD/MM/YYYY HH:MM format.
 * @param dateString The date string.
 * @returns Formatted date and time string.
 */
export const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};