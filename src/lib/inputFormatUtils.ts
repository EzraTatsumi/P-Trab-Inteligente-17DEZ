// Converte um número para string formatada em moeda brasileira (R$ 1.234,56)
export const formatCurrencyInput = (value: number | string | undefined): string => {
  if (value === undefined || value === null || value === "") return "";
  
  const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
  if (isNaN(num)) return "";

  // Usa Intl.NumberFormat para garantir a formatação correta de milhar e decimal
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

// Converte a string formatada (R$ 1.234,56) de volta para um número (1234.56)
export const parseCurrencyInput = (value: string): number => {
  if (!value) return 0;
  
  // Remove pontos de milhar e substitui vírgula decimal por ponto
  const cleanedValue = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleanedValue);
  
  return isNaN(num) ? 0 : num;
};