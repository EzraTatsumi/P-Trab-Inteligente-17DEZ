import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata um valor numérico para a moeda brasileira (R$).
 * @param value O valor numérico.
 * @returns String formatada como R$ X.XXX,XX.
 */
export const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return 'R$ 0,00';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Formata um valor numérico para o padrão brasileiro (X.XXX,XX).
 * @param value O valor numérico.
 * @returns String formatada como X.XXX,XX.
 */
export const formatNumber = (value: number | string | null | undefined, decimals: number = 2): string => {
  if (value === null || value === undefined) return '0';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

/**
 * Formata uma data ISO para o formato DD/MM/AAAA.
 * @param dateString A string de data ISO.
 * @returns String formatada.
 */
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'dd/MM/yyyy');
  } catch (e) {
    return dateString;
  }
};

/**
 * Formata uma data ISO para o formato DDMMMAA (ex: 25DEZ24).
 * @param dateString A string de data ISO.
 * @returns String formatada.
 */
export const formatDateDDMMMAA = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  try {
    const date = parseISO(dateString);
    // Formato: DD + Mês abreviado em maiúsculas (ex: DEZ) + AA
    const day = format(date, 'dd');
    const month = format(date, 'MMM', { locale: ptBR }).toUpperCase().slice(0, 3);
    const year = format(date, 'yy');
    return `${day}${month}${year}`;
  } catch (e) {
    return '';
  }
};

/**
 * Formata o código UG, removendo caracteres não numéricos e garantindo que seja uma string.
 * @param codug O código UG (pode ser string, null ou undefined).
 * @returns String formatada (apenas números).
 */
export const formatCodug = (codug: string | null | undefined): string => {
  if (codug === null || codug === undefined) {
    return '';
  }
  // Garante que é uma string antes de chamar replace
  const strCodug = String(codug);
  // Remove todos os caracteres que não são dígitos
  return strCodug.replace(/\D/g, '');
};

/**
 * Converte um valor de moeda formatado (ex: R$ 1.234,56) para um número.
 * @param formattedValue O valor formatado.
 * @returns O valor como número.
 */
export const parseCurrency = (formattedValue: string | null | undefined): number => {
  if (!formattedValue) return 0;
  
  // Remove R$, pontos de milhar e substitui vírgula decimal por ponto
  const cleanedValue = formattedValue
    .replace(/[R$]/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .trim();
    
  const num = parseFloat(cleanedValue);
  return isNaN(num) ? 0 : num;
};