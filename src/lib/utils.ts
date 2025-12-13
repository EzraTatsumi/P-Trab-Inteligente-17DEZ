import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility functions for currency handling
export const formatCurrency = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replace('R$', '').trim();
};

export const parseCurrency = (value: string): number => {
  if (!value) return 0;
  const cleanedValue = value.replace(/[R$.]/g, '').replace(',', '.');
  const num = parseFloat(cleanedValue);
  return isNaN(num) ? 0 : num;
};