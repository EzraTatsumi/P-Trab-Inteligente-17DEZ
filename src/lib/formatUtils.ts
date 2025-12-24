export const formatCurrencyInput = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return { formatted: '', raw: 0 };
  }

  // Convertendo para string e removendo caracteres não numéricos, exceto o ponto decimal
  let stringValue = String(value).replace(/[^\d,.]/g, '');

  // Substitui vírgula por ponto para padronização interna
  stringValue = stringValue.replace(',', '.');

  // Remove pontos extras, mantendo apenas o primeiro como separador decimal
  const parts = stringValue.split('.');
  if (parts.length > 2) {
    stringValue = parts[0] + '.' + parts.slice(1).join('');
  }

  // Remove zeros à esquerda, exceto se for '0' ou '0.'
  if (stringValue.length > 1 && stringValue.startsWith('0') && !stringValue.startsWith('0.')) {
    stringValue = stringValue.substring(1);
  }

  // Se o valor for apenas um ponto, trate como 0
  if (stringValue === '.') {
    stringValue = '0.';
  }

  // Se o valor for vazio após a limpeza, retorne 0
  if (stringValue === '') {
    return { formatted: '', raw: 0 };
  }

  // Converte para centavos (inteiro) para evitar problemas de ponto flutuante
  const rawValue = Math.round(parseFloat(stringValue) * 100);

  // Formatação para exibição (R$ X.XXX,XX)
  const integerPart = Math.floor(rawValue / 100);
  const decimalPart = (rawValue % 100).toString().padStart(2, '0');

  const formatted = `${integerPart.toLocaleString('pt-BR')},${decimalPart}`;

  return { formatted, raw: rawValue / 100 };
};

export const parseCurrencyInput = (formattedValue: string): number => {
  if (!formattedValue) return 0;

  // Remove R$, pontos de milhar e substitui vírgula por ponto decimal
  const cleanedValue = formattedValue
    .replace('R$', '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();

  const parsed = parseFloat(cleanedValue);
  return isNaN(parsed) ? 0 : parsed;
};

export const formatCurrencyDisplay = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};