const currentYear = new Date().getFullYear();
const yearSuffix = `/${currentYear}`;

/**
 * Generates the next sequential PTrab number (e.g., 5/2025).
 * @param existingNumbers Array of existing PTrab numbers (e.g., ['1/2025', '4.1/2025']).
 * @returns The next unique base number.
 */
export const generateUniquePTrabNumber = (existingNumbers: string[]): string => {
  const currentYearStr = String(currentYear);
  
  // 1. Encontrar o maior número base existente para o ano atual
  // Filtra por números que terminam com /YYYY e não contêm variações (ponto)
  const numbersForCurrentYear = existingNumbers
    .filter(num => num && typeof num === 'string' && num.endsWith(`/${currentYearStr}`) && !num.includes('.'))
    .map(num => parseInt(num.split('/')[0]))
    .filter(num => !isNaN(num));

  let maxNumber = numbersForCurrentYear.length > 0 ? Math.max(...numbersForCurrentYear) : 0;
  
  let nextNumber = maxNumber + 1;
  let suggestedNumber = `${nextNumber}${yearSuffix}`;

  // 2. Garantir que o número sugerido seja realmente único
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
  const baseNumber = baseNumberMatch ? baseNumberAndYear.split('.')[0] : ''; // Use base number before variation dot

  if (!baseNumber) return `1.1${yearSuffix}`;

  const variationNumbers = existingNumbers
    .filter(num => num && typeof num === 'string' && num.startsWith(`${baseNumber}.`) && num.endsWith(`/${year}`))
    .map(num => {
      const variationPart = num.split('/')[0].split('.')[1];
      return parseInt(variationPart);
    })
    .filter(num => !isNaN(num));

  const maxVariation = variationNumbers.length > 0 ? Math.max(...variationNumbers) : 0;
  return `${baseNumber}.${maxVariation + 1}${yearSuffix}`;
};

/**
 * Generates the next sequential PTrab number in the format N/YYYY/OM_SIGLA.
 * @param existingNumbers Array of existing PTrab numbers.
 * @param omSigla The OM Sigla to append.
 * @returns The next unique number in the new format.
 */
export const generateApprovalPTrabNumber = (existingNumbers: string[], omSigla: string): string => {
  const currentYearStr = String(currentYear);
  // Mantém a caixa da sigla da OM como está no banco de dados
  const omSuffix = omSigla; 
  
  // 1. Find the largest base number for the current year, regardless of OM Sigla
  // We look for numbers matching the pattern N/YYYY/OM_SIGLA or N/YYYY
  const numbersForCurrentYear = existingNumbers
    .filter(num => num && typeof num === 'string' && num.includes(`/${currentYearStr}`))
    .map(num => {
      const parts = num.split('/');
      // If format is N/YYYY/OM, take N
      if (parts.length === 3) return parseInt(parts[0]);
      // If format is N/YYYY, take N
      if (parts.length === 2 && !parts[0].includes('.')) return parseInt(parts[0]);
      return NaN;
    })
    .filter(num => !isNaN(num));

  let maxNumber = numbersForCurrentYear.length > 0 ? Math.max(...numbersForCurrentYear) : 0;
  
  let nextNumber = maxNumber + 1;
  let suggestedNumber = `${nextNumber}${yearSuffix}/${omSuffix}`;

  // 2. Ensure the suggested number is unique
  while (isPTrabNumberDuplicate(suggestedNumber, existingNumbers)) {
    nextNumber++;
    suggestedNumber = `${nextNumber}${yearSuffix}/${omSuffix}`;
  }
  
  return suggestedNumber;
};

/**
 * Generates a unique 'Minuta' number (e.g., 'Minuta-1', 'Minuta-2').
 * @param existingNumbers Array of existing PTrab numbers.
 * @returns A unique Minuta number string.
 */
export const generateUniqueMinutaNumber = (existingNumbers: string[]): string => {
  const minutaPrefix = "Minuta";
  
  // 1. Encontrar o maior número de Minuta existente
  const minutaNumbers = existingNumbers
    .filter(num => num && typeof num === 'string' && num.startsWith(minutaPrefix))
    .map(num => {
      const parts = num.split('-');
      if (parts.length === 2) {
        return parseInt(parts[1]);
      }
      // Se for apenas "Minuta", considera 1 para começar a contagem
      return parts.length === 1 ? 1 : 0;
    })
    .filter(num => !isNaN(num));

  let maxNumber = minutaNumbers.length > 0 ? Math.max(...minutaNumbers) : 0;
  
  let nextNumber = maxNumber + 1;
  let suggestedNumber = `${minutaPrefix}-${nextNumber}`;

  // 2. Garantir que o número sugerido seja realmente único
  while (isPTrabNumberDuplicate(suggestedNumber, existingNumbers)) {
    nextNumber++;
    suggestedNumber = `${minutaPrefix}-${nextNumber}`;
  }
  
  return suggestedNumber;
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