/**
 * Formata um valor numérico para a moeda brasileira (Real - R$).
 * @param value O valor numérico a ser formatado.
 * @returns A string formatada (ex: R$ 1.234,56).
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

/**
 * Formata um valor numérico para o padrão brasileiro (ponto como separador de milhar, vírgula como decimal).
 * @param value O valor numérico a ser formatado.
 * @param decimals O número de casas decimais (padrão: 0).
 * @returns A string formatada (ex: 1.234,56).
 */
export const formatNumber = (value: number, decimals: number = 0): string => {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Converte uma string de entrada (permitindo vírgula como separador decimal e pontos como separadores de milhar) em um número.
 * Remove separadores de milhar (pontos) e substitui a vírgula por ponto decimal.
 * @param input A string de entrada.
 * @returns O valor numérico (ou 0 se inválido).
 */
export const parseInputToNumber = (input: string): number => {
  // 1. Remove dots (thousand separators)
  // 2. Replace comma (decimal separator) with dot
  const cleaned = input.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

/**
 * Formata um número para exibição em um campo de entrada usando o padrão brasileiro (vírgula para decimal).
 * Garante um número mínimo de casas decimais.
 * @param num O número a ser formatado.
 * @param minFractionDigits O número mínimo de casas decimais (padrão: 2).
 * @returns A string formatada para exibição no input (ex: "1.234,56" ou "" se for 0).
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
 * Limpa uma string de entrada bruta, removendo caracteres inválidos e formatando a parte inteira/decimal
 * de forma permissiva durante a digitação.
 * @param value A string de entrada bruta.
 * @returns A string limpa e formatada.
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
  
  // 3. Remove todos os pontos (separadores de milhar) para simplificar a entrada
  // A formatação de milhar será aplicada apenas no blur/saída do campo.
  
  // Se houver vírgula, remove todos os pontos da parte inteira
  if (cleaned.includes(',')) {
    const [integerPart, decimalPart] = cleaned.split(',');
    const cleanInteger = integerPart.replace(/\./g, '');
    
    // Limita a parte decimal a 4 dígitos (para ser flexível, mas seguro)
    const limitedDecimal = decimalPart.substring(0, 4); 
    
    return `${cleanInteger}${limitedDecimal ? `,${limitedDecimal}` : ''}`;
  }
  
  // Se não houver vírgula, remove todos os pontos
  return cleaned.replace(/\./g, '');
};