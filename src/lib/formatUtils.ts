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
  if (num === 0) return "";
  
  // Use Intl.NumberFormat to format with thousand separator (dot) and decimal separator (comma)
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: minFractionDigits,
  }).format(num);
};

/**
 * Cleans and formats a raw string input, applying thousand separators (dots) 
 * and ensuring only one comma (decimal separator) is presente.
 * This is used during onChange to provide live formatting feedback.
 */
export const formatInputWithThousands = (value: string): string => {
  // 1. Remove tudo exceto dígitos, ponto e vírgula
  let cleaned = value.replace(/[^\d,.]/g, '');

  // 2. Trata a vírgula como separador decimal
  const decimalIndex = cleaned.indexOf(',');
  if (decimalIndex !== -1) {
    // Parte inteira: remove todos os pontos e vírgulas após a primeira vírgula
    const integerPart = cleaned.substring(0, decimalIndex).replace(/\./g, '');
    let decimalPart = cleaned.substring(decimalIndex + 1).replace(/,/g, '').replace(/\./g, '');
    
    // Reinsere a vírgula para exibição
    cleaned = `${integerPart}${decimalPart ? `,${decimalPart}` : ''}`;
  } else {
    // Se não tem vírgula, remove todos os pontos
    cleaned = cleaned.replace(/\./g, '');
  }
  
  // Aplica a formatação de milhar (ponto) na parte inteira
  const parts = cleaned.split(',');
  let integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return parts.length > 1 ? `${integerPart},${parts[1]}` : integerPart;
};