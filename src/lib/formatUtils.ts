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

/**
 * Converts a numeric value (e.g., 123.45) into a raw digits string (e.g., "12345").
 * @param value The numeric value.
 * @returns Raw digits string.
 */
export const numberToRawDigits = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return "0";
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  
  // Multiply by 100 and round to handle floating point issues, then convert to string
  return String(Math.round(num * 100));
};

/**
 * Formats a raw digits string (e.g., "12345") into a currency display string (e.g., "123,45")
 * and calculates the numeric value (e.g., 123.45).
 * @param rawDigits The raw digits string (e.g., "12345").
 * @returns Object containing formatted string and numeric value.
 */
export const formatCurrencyInput = (rawDigits: string): { formatted: string, numericValue: number, digits: string } => {
  const cleanedDigits = rawDigits.replace(/\D/g, '');
  const digits = cleanedDigits.padStart(3, '0'); // Ensure at least 3 digits (e.g., "000" for 0.00)

  // Insert comma two places from the right
  const integerPart = digits.slice(0, -2);
  const decimalPart = digits.slice(-2);
  
  // Format integer part with thousand separators
  const formattedInteger = integerPart.replace(/^0+/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  let formatted = `${formattedInteger || '0'},${decimalPart}`;
  
  // Calculate numeric value
  const numericValue = parseFloat(`${integerPart || '0'}.${decimalPart}`);

  return { formatted, numericValue: isNaN(numericValue) ? 0 : numericValue, digits: cleanedDigits };
};

/**
 * Parses a formatted input string (e.g., "1.234,56") back to a numeric value.
 * @param input The formatted string.
 * @returns The numeric value.
 */
export const parseInputToNumber = (input: string | null | undefined): number => {
  if (!input) return 0;
  // Remove thousand separators (dots) and replace comma with dot for float parsing
  const cleaned = input.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

/**
 * Formats a numeric value for display in a standard input field (not currency input component).
 * @param value The numeric value.
 * @param decimals Number of decimal places.
 * @returns Formatted string (e.g., "1.234,56").
 */
export const formatNumberForInput = (value: number | string | null | undefined, decimals: number = 0): string => {
  if (value === null || value === undefined) return decimals > 0 ? '0,00' : '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return decimals > 0 ? '0,00' : '0';

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

/**
 * Formats a number with thousand separators (for display only, not input).
 * @param value The numeric value.
 * @returns Formatted string (e.g., 1.234).
 */
export const formatInputWithThousands = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
  }).format(num);
};