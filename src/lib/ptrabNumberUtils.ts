const currentYear = new Date().getFullYear();
const yearSuffix = `/${currentYear}`;

/**
 * Generates the next sequential PTrab number (e.g., 5/2025).
 * @param existingNumbers Array of existing PTrab numbers (e.g., ['1/2025', '4.1/2025', 'MINUTA']).
 * @returns The next unique base number.
 */
export const generateUniquePTrabNumber = (existingNumbers: string[]): string => {
  const currentYearStr = String(currentYear);
  
  // 1. Encontrar o maior número base existente para o ano atual, excluindo 'MINUTA'
  const numbersForCurrentYear = existingNumbers
    .filter(num => num.endsWith(`/${currentYearStr}`) && !num.includes('.') && num.toUpperCase() !== 'MINUTA') // Filter base numbers for current year
    .map(num => parseInt(num.split('/')[0]))
    .filter(num => !isNaN(num));

  let maxNumber = numbersForCurrentYear.length > 0 ? Math.max(...numbersForCurrentYear) : 0;
  
  let nextNumber = maxNumber + 1;
  let suggestedNumber = `${nextNumber}${yearSuffix}`;

  // 2. Garantir que o número sugerido seja realmente único (caso o cálculo do maxNumber tenha falhado ou haja números não sequenciais)
  while (isPTrabNumberDuplicate(suggestedNumber, existingNumbers)) {
    nextNumber++;
    suggestedNumber = `${nextNumber}${yearSuffix}`;
  }
  
  return suggestedNumber;
};

/**
 * Generates the next variation PTrab number (e.g., 4.1/2025 -> 4.2/2025).
 * @param originalPTrabNumber The base PTrab number (e.g., '4/2025').
 * @param existingNumbers Array of existing PTrab numbers.
 * @returns The next unique variation number.
 */
export const generateVariationPTrabNumber = (originalPTrabNumber: string, existingNumbers: string[]): string => {
  const parts = originalPTrabNumber.split('/');
  const baseNumberAndYear = parts[0];
  const year = parts[1] || String(currentYear);

  const baseNumberMatch = baseNumberAndYear.match(/^(\d+)/);
  const baseNumber = baseNumberMatch ? baseNumberMatch[1] : '';

  if (!baseNumber) return `1.1${yearSuffix}`;

  const variationNumbers = existingNumbers
    .filter(num => num.startsWith(`${baseNumber}.`) && num.endsWith(`/${year}`))
    .map(num => {
      const variationPart = num.split('/')[0].split('.')[1];
      return parseInt(variationPart);
    })
    .filter(num => !isNaN(num));

  const maxVariation = variationNumbers.length > 0 ? Math.max(...variationNumbers) : 0;
  return `${baseNumber}.${maxVariation + 1}${yearSuffix}`;
};

/**
 * Checks if a PTrab number already exists in the list.
 * @param numberToCheck The PTrab number to validate.
 * @param existingNumbers Array of existing PTrab numbers.
 * @returns True if the number exists, false otherwise.
 */
export const isPTrabNumberDuplicate = (numberToCheck: string, existingNumbers: string[]): boolean => {
    return existingNumbers.includes(numberToCheck);
};