import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "R$ 0,00";
  const val = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
};

export const formatNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "0";
  const val = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR").format(val);
};

export const formatPregao = (pregao: string | null | undefined): string => {
  if (!pregao) return "";
  const cleaned = pregao.replace(/[^\d/]/g, "");
  if (cleaned.includes("/")) {
    const [num, ano] = cleaned.split("/");
    return `${num.padStart(3, "0")}/${ano}`;
  }
  return cleaned;
};

export const formatCodug = (codug: string | number | null | undefined): string => {
  if (!codug) return "";
  const s = String(codug).padStart(6, '0');
  return `${s.slice(0, 3)}.${s.slice(3)}`;
};

// Alias para formatCodug conforme solicitado para semântica de UASG
export const formatUasg = formatCodug;

export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "";
  try {
    const date = parseISO(dateString);
    return format(date, 'dd/MM/yyyy');
  } catch (e) {
    return "";
  }
};

export const formatDateDDMMMAA = (dateString: string | null | undefined): string => {
  if (!dateString) return "";
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, "dd MMM yy", { locale: ptBR }).toUpperCase();
  } catch (e) {
    return "";
  }
};

export const calculateDays = (startDate: string, endDate: string): number => {
  if (!startDate || !endDate) return 0;
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return differenceInDays(end, start) + 1;
  } catch (e) {
    return 0;
  }
};

/**
 * Converte um valor numérico para uma string de dígitos (centavos)
 */
export const numberToRawDigits = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return "";
  const val = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(val)) return "";
  return Math.round(val * 100).toString();
};

/**
 * Formata uma string de dígitos como moeda para exibição em inputs
 */
export const formatCurrencyInput = (rawDigits: string): { numericValue: number; digits: string; formatted: string } => {
  const digits = rawDigits.replace(/\D/g, "");
  const numericValue = parseInt(digits || "0", 10) / 100;
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
  return { numericValue, digits, formatted };
};