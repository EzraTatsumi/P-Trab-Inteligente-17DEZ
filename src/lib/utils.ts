import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatCurrency, parseInputToNumber } from "./formatUtils"; // Import from formatUtils

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-exporting currency utilities for use in forms
export const parseCurrency = parseInputToNumber;
export { formatCurrency };