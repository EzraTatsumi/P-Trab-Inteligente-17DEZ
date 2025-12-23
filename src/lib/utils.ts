import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a numeric string or number into a Brazilian currency (R$) format for input display.
 * It handles both the display format and returns the clean numeric value.
 * @param value The input value (string or number).
 * @returns An object containing the formatted string and the clean numeric value.
 */
export function formatCurrencyInput(value: string | number | null | undefined): { formatted: string, numeric: number } {
  if (value === null || value === undefined || value === '') {
    return { formatted: '', numeric: 0 };
  }

  // Convert to string and remove non-numeric characters except comma/dot
  let stringValue = String(value).replace(/[^\d,.]/g, '');

  // Replace comma with dot for consistent parsing
  stringValue = stringValue.replace(',', '.');

  // Parse to float
  let numericValue = parseFloat(stringValue);

  if (isNaN(numericValue)) {
    numericValue = 0;
  }

  // Format for display (R$ 1.234,56)
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);

  return { formatted, numeric: numericValue };
}

/**
 * Parses a formatted currency string back into a clean numeric string (e.g., '1234.56').
 * This is useful for handling onChange events in currency inputs.
 * @param formattedValue The formatted string from the input.
 * @returns The clean numeric string representation.
 */
export function parseCurrencyInput(formattedValue: string): string {
  if (!formattedValue) return '';

  // Remove R$, thousands separators (.), and replace comma (,) with dot (.)
  let cleanValue = formattedValue.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.');

  // If the input is just a comma or dot, treat it as empty
  if (cleanValue === '.' || cleanValue === '') {
    return '';
  }
  
  // Ensure only one decimal point exists (if user types multiple)
  const parts = cleanValue.split('.');
  if (parts.length > 2) {
    cleanValue = parts[0] + '.' + parts.slice(1).join('');
  }

  return cleanValue;
}

/**
 * Formats a numeric string or number into a standard numeric format (e.g., 1.234,56) for input display.
 * @param value The input value (string or number).
 * @param decimals The number of decimal places to enforce.
 * @returns An object containing the formatted string and the clean numeric value.
 */
export function formatNumericInput(value: string | number | null | undefined, decimals: number = 2): { formatted: string, numeric: number } {
  if (value === null || value === undefined || value === '') {
    return { formatted: '', numeric: 0 };
  }

  // Convert to string and remove non-numeric characters except comma/dot
  let stringValue = String(value).replace(/[^\d,.]/g, '');

  // Replace comma with dot for consistent parsing
  stringValue = stringValue.replace(',', '.');

  // Parse to float
  let numericValue = parseFloat(stringValue);

  if (isNaN(numericValue)) {
    numericValue = 0;
  }

  // Format for display (1.234,56)
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numericValue);

  return { formatted, numeric: numericValue };
}

/**
 * Parses a formatted numeric string back into a clean numeric string (e.g., '1234.56').
 * @param formattedValue The formatted string from the input.
 * @returns The clean numeric string representation.
 */
export function parseNumericInput(formattedValue: string): string {
  if (!formattedValue) return '';

  // Remove thousands separators (.), and replace comma (,) with dot (.)
  let cleanValue = formattedValue.replace(/\./g, '').replace(',', '.');

  // If the input is just a comma or dot, treat it as empty
  if (cleanValue === '.' || cleanValue === '') {
    return '';
  }
  
  // Ensure only one decimal point exists
  const parts = cleanValue.split('.');
  if (parts.length > 2) {
    cleanValue = parts[0] + '.' + parts.slice(1).join('');
  }

  return cleanValue;
}