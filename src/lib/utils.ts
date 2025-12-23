import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number to a string using Brazilian locale (comma as decimal separator, dot as thousands separator).
 * @param value The number to format.
 * @returns Formatted string (e.g., 1.234,56) or empty string if invalid.
 */
export function formatNumberToCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  
  let num: number;
  if (typeof value === 'string') {
    // Try to parse the string, assuming it might already be in a parsable format (e.g., from RHF state)
    num = parseFloat(value);
  } else {
    num = value;
  }
  
  if (isNaN(num)) return '';
  
  // Use Brazilian locale for formatting
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });
}

/**
 * Parses a currency string (using comma as decimal separator) back into a number.
 * @param value The string to parse (e.g., "1.234,56").
 * @returns The parsed number or null if invalid/empty.
 */
export function parseCurrencyToNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  
  // 1. Ensure it's a string
  const strValue = String(value);
  
  // 2. Remove thousands separators (dots) and replace comma with dot for standard JS parsing
  const cleanedValue = strValue
    .replace(/\./g, '') // Remove dots (thousands separator)
    .replace(/,/g, '.'); // Replace comma (decimal separator) with dot
    
  const num = parseFloat(cleanedValue);
  
  // Return null if parsing results in NaN
  return isNaN(num) ? null : num;
}