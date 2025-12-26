/**
 * Formats a number as currency (BRL).
 * @param value The numeric value.
 * @returns Formatted string (e.g., R$ 1.234,56).
 */
export const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return 'R$ 0,00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
};

/**
 * Formats a number with thousand separators.
 * @param value The numeric value.
 * @returns Formatted string (e.g., 1.234).
 */
export const formatNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
  }).format(num);
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