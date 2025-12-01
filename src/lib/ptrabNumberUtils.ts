const currentYear = new Date().getFullYear();
const yearSuffix = `/${currentYear}`;

/**
 * Generates the next sequential PTrab number (e.g., 5/2025).
 * @param existingNumbers Array of existing PTrab numbers (e.g., ['1/2025/OM', '4.1/2025/OM']).
 * @returns The next unique base number (e.g., '6/2025').
 */
export const generateUniquePTrabNumber = (existingNumbers: string[]): string => {
  const currentYearStr = String(currentYear);
  
  // 1. Encontrar o maior número base existente para o ano atual, ignorando sufixos de OM e variações (.1)
  const numbersForCurrentYear = existingNumbers
    .filter(num => num.includes(`/${currentYearStr}`) && !num.includes('.')) // Filter for current year base numbers
    .map(num => {
      // Remove o sufixo da OM (se existir) e o ano, deixando apenas o número base
      const basePart = num.split('/')[0];
      return parseInt(basePart);
    })
    .filter(num => !isNaN(num));

  let maxNumber = numbersForCurrentYear.length > 0 ? Math.max(...numbersForCurrentYear) : 0;
  
  let nextNumber = maxNumber + 1;
  let suggestedNumber = `${nextNumber}${yearSuffix}`;

  // 2. Garantir que o número sugerido (sem OM) seja realmente único
  while (existingNumbers.some(num => num.startsWith(suggestedNumber))) {
    nextNumber++;
    suggestedNumber = `${nextNumber}${yearSuffix}`;
  }
  
  return suggestedNumber;
};

/**
 * Generates the next variation PTrab number (e.g., 4.1/2025/OM -> 4.2/2025/OM).
 * @param originalPTrabNumber The base PTrab number (e.g., '4/2025/OM').
 * @param existingNumbers Array of existing PTrab numbers.
 * @returns The next unique variation number (e.g., '4.2/2025').
 */
export const generateVariationPTrabNumber = (originalPTrabNumber: string, existingNumbers: string[]): string => {
  const parts = originalPTrabNumber.split('/');
  const baseNumberAndVariation = parts[0];
  const year = parts[1] || String(currentYear);

  const baseNumberMatch = baseNumberAndVariation.match(/^(\d+)/);
  const baseNumber = baseNumberMatch ? baseNumberMatch[1] : '';

  if (!baseNumber) return `1.1${yearSuffix}`;

  const variationNumbers = existingNumbers
    .filter(num => num.startsWith(`${baseNumber}.`) && num.includes(`/${year}`))
    .map(num => {
      // Remove o sufixo da OM e o ano, deixando apenas a variação (.1, .2, etc.)
      const variationPart = num.split('/')[0].split('.')[1];
      return parseInt(variationPart);
    })
    .filter(num => !isNaN(num));

  const maxVariation = variationNumbers.length > 0 ? Math.max(...variationNumbers) : 0;
  return `${baseNumber}.${maxVariation + 1}${yearSuffix}`;
};

/**
 * Checks if a PTrab number already exists in the list.
 * NOTE: This checks against the full number (e.g., 1/2025/OM).
 * @param numberToCheck The PTrab number to validate.
 * @param existingNumbers Array of existing PTrab numbers.
 * @returns True if the number exists, false otherwise.
 */
export const isPTrabNumberDuplicate = (numberToCheck: string, existingNumbers: string[]): boolean => {
    return existingNumbers.includes(numberToCheck);
};