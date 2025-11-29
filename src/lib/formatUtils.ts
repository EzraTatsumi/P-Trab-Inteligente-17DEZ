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
 * Cleans a raw string input, allowing only digits, dots (for thousands), and one comma (for decimal).
 * This version is designed to be permissive during typing.
 */
export const formatInputWithThousands = (value: string): string => {
  // 1. Remove tudo exceto dígitos, ponto e vírgula
  let cleaned = value.replace(/[^\d,.]/g, '');

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
    
    // Limita a parte decimal a 2 dígitos (para preço) ou 4 (para consumo, se necessário)
    // Vamos deixar a limitação de dígitos para o componente que chama, mas aqui limitamos a 4 para segurança.
    const limitedDecimal = decimalPart.substring(0, 4); 
    
    return `${cleanInteger}${limitedDecimal ? `,${limitedDecimal}` : ''}`;
  }
  
  // Se não houver vírgula, remove todos os pontos
  return cleaned.replace(/\./g, '');
};