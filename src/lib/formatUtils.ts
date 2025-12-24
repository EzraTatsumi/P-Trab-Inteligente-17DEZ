import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formats a number into Brazilian Real currency string (R$ 1.234,56).
 */
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
};

/**
 * Formats a number with thousands separators (e.g., 1234567.89 -> 1.234.567,89).
 * Defaults to 0 decimal places if precision is not specified.
 */
export const formatNumber = (amount: number | null | undefined, precision: number = 0): string => {
  if (amount === null || amount === undefined) return '0';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(amount);
};

/**
 * Formats a date string (ISO or Date object) to DD/MMM/AA (e.g., 25/DEZ/24).
 */
export const formatDateDDMMMAA = (dateString: string | Date): string => {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return 'Data Inválida';
    // Usa date-fns para formatação, garantindo o locale pt-BR
    return format(date, 'dd/MMM/yy', { locale: ptBR }).toUpperCase();
  } catch (e) {
    return 'Data Inválida';
  }
};

// --- Utility functions for currency input handling (using comma as decimal separator) ---

/**
 * Formats a raw number (e.g., 1234.56) into a string suitable for input display (e.g., "1.234,56").
 * Returns an empty string if the number is 0.
 */
export const formatNumberToInputString = (num: number): string => {
  if (num === 0 || isNaN(num)) return "";
  // Use Intl.NumberFormat for formatting with thousands separator (dot) and decimal separator (comma)
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Cleans and formats the raw input string, applying thousands separators (dots) and limiting decimals to 2 (comma).
 */
export const formatInputString = (value: string): string => {
  // 1. Remove everything except digits, point, and comma
  let cleaned = value.replace(/[^\d,.]/g, '');

  // 2. Handle decimal separator (comma)
  const decimalIndex = cleaned.indexOf(',');
  if (decimalIndex !== -1) {
    // Ensure only the first comma is treated as decimal separator
    const integerPart = cleaned.substring(0, decimalIndex).replace(/\./g, '');
    let decimalPart = cleaned.substring(decimalIndex + 1).replace(/,/g, '');
    
    // Limit decimal part to 2 digits
    decimalPart = decimalPart.substring(0, 2);
    
    // Reinsert the comma for display
    cleaned = `${integerPart}${decimalPart ? `,${decimalPart}` : ''}`;
  } else {
    // If no comma, remove all dots (which might be used as thousands separators during typing)
    cleaned = cleaned.replace(/\./g, '');
  }
  
  // 3. Apply thousands formatting (dot) to the integer part
  const parts = cleaned.split(',');
  // Regex to insert dots every 3 digits from the right
  let integerPartFormatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return parts.length > 1 ? `${integerPartFormatted},${parts[1]}` : integerPartFormatted;
};

/**
 * Parses a formatted input string (e.g., "1.234,56") back into a standard number (1234.56).
 */
export const parseInputToNumber = (input: string): number => {
  // Remove thousands separators (dots) and replace comma with decimal point
  const cleaned = input.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};