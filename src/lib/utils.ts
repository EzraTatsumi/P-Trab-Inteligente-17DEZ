import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata um número para a moeda brasileira (R$).
 * @param value O valor numérico.
 * @returns A string formatada.
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "R$ 0,00";
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return "R$ 0,00";
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

/**
 * Converte uma string de moeda formatada (R$ 1.234,56) para um número.
 * @param value A string formatada.
 * @returns O valor numérico.
 */
export function parseCurrency(value: string | null | undefined): number {
  if (!value) return 0;
  
  // Remove R$, pontos de milhar e substitui vírgula decimal por ponto
  const cleanedValue = value.replace(/[R$]/g, '').replace(/\./g, '').replace(',', '.').trim();
  const num = parseFloat(cleanedValue);
  
  return isNaN(num) ? 0 : num;
}