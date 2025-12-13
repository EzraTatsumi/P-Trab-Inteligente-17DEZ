import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return "";
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function parseCurrency(value: string): number {
  if (!value) return 0;
  // Remove R$, dots, and replace comma with dot for parsing
  const cleanedValue = value.replace(/[R$\s.]/g, '').replace(',', '.');
  const num = parseFloat(cleanedValue);
  return isNaN(num) ? 0 : num;
}