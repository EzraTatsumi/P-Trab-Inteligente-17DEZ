import { format } from 'date-fns';

// --- Currency Input Formatting Utilities ---

/**
 * Converts a numeric value (e.g., 1234.56) to the raw digit string format (e.g., "123456").
 * Used for initializing state for currency inputs.
 */
export const numberToRawDigits = (num: number): string => {
  if (typeof num !== 'number' || isNaN(num)) return "";
  // Multiply by 100, round to handle floating point issues, and convert to string
  return (Math.round(num * 100)).toString();
};

/**
 * Converts raw digits string ("123456") back to number (1234.56).
 * Used for final calculation/saving.
 */
export const rawDigitsToNumber = (rawDigits: string): number => {
  if (!rawDigits) return 0;
  const num = parseInt(rawDigits.replace(/[^\d]/g, ''), 10);
  if (isNaN(num)) return 0;
  return num / 100;
};

/**
 * Handles currency input masking.
 * Takes a raw input string (from event.target.value or raw digits state)
 * and returns the formatted string for display and the cleaned raw digits string for state storage.
 * @param value The input string (can be raw digits or formatted string).
 * @returns { formatted: string, digits: string }
 */
export const formatCurrencyInput = (value: string): { formatted: string; digits: string } => {
  // 1. Clean the input: remove everything except digits
  const cleanedDigits = value.replace(/[^\d]/g, '');

  if (!cleanedDigits) {
    return { formatted: '', digits: '' };
  }

  // 2. Pad with leading zeros if necessary (e.g., "5" -> "005")
  const paddedDigits = cleanedDigits.padStart(3, '0');

  // 3. Separate integer and decimal parts
  const integerPart = paddedDigits.slice(0, -2);
  const decimalPart = paddedDigits.slice(-2);

  // 4. Format integer part with thousands separator (dot)
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // 5. Combine parts with decimal separator (comma)
  const formatted = `${formattedInteger},${decimalPart}`;

  return { formatted, digits: cleanedDigits };
};

// --- General Formatting Utilities (assuming these existed previously) ---

/**
 * Formats a number as Brazilian currency (R$ X.XXX,XX).
 */
export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    value = 0;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

/**
 * Formats a date object or string into 'dd/MM/yyyy'.
 */
export const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  try {
    return format(new Date(date), 'dd/MM/yyyy');
  } catch (e) {
    return '';
  }
};

/**
 * Formats a date object or string into 'dd/MMM/yy' (e.g., 25/DEZ/24).
 */
export const formatDateDDMMMAA = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  try {
    // Formato 'dd/MMM/yy' em português
    return format(new Date(date), 'dd/MMM/yy', { locale: { format: { MMM: (date) => format(date, 'MMM', { locale: { format: { MMM: (date) => format(date, 'MMM').toUpperCase() } } }).toUpperCase() } } }).toUpperCase();
  } catch (e) {
    // Fallback para o formato padrão se houver erro de locale
    return format(new Date(date), 'dd/MM/yy');
  }
};

/**
 * Formats a number with thousands separator (dot) and two decimal places (comma).
 */
export const formatNumber = (num: number | null | undefined, decimals: number = 2): string => {
  if (num === null || num === undefined || isNaN(num)) return '0,00';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

/**
 * Retorna o intervalo de datas da semana anterior (segunda a domingo) no formato 'yyyy-MM-dd'.
 */
export const getPreviousWeekRange = (): { start: string, end: string } => {
  const today = new Date();
  // Move para o domingo da semana atual
  const currentSunday = new Date(today.setDate(today.getDate() - today.getDay()));
  
  // Move para o domingo da semana anterior
  const previousSunday = new Date(currentSunday.setDate(currentSunday.getDate() - 7));
  
  // Move para a segunda-feira da semana anterior
  const previousMonday = new Date(previousSunday.setDate(previousSunday.getDate() - 6));
  
  // O fim é o domingo da semana anterior
  const end = format(previousSunday, 'yyyy-MM-dd');
  const start = format(previousMonday, 'yyyy-MM-dd');
  
  return { start, end };
};