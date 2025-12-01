const currentYear = new Date().getFullYear();
const yearSuffix = `/${currentYear}`;

/**
 * Generates the next sequential PTrab number (e.g., 5/2025).
 * @param existingNumbers Array of existing PTrab numbers (e.g., ['1/2025/OM', '4.1/2025/OM']).
 * @returns The next unique base number.
 */
export const generateUniquePTrabNumber = (existingNumbers: string[]): string => {
  const currentYearStr = String(currentYear);
  
  // 1. Encontrar o maior número base existente para o ano atual, ignorando a OM
  const numbersForCurrentYear = existingNumbers
    .map(num => num.split('/'))
    .filter(parts => parts.length >= 2 && parts[1] === currentYearStr && !parts[0].includes('.')) // Filter base numbers for current year
    .map(parts => parseInt(parts[0]))
    .filter(num => !isNaN(num));

  let maxNumber = numbersForCurrentYear.length > 0 ? Math.max(...numbersForCurrentYear) : 0;
  
  let nextNumber = maxNumber + 1;
  let suggestedNumber = `${nextNumber}`; // Retorna apenas o número base

  // 2. Garantir que o número sugerido seja realmente único (apenas o número base)
  // A validação completa de duplicidade será feita no momento da aprovação, mas aqui garantimos o próximo sequencial.
  while (existingNumbers.some(num => num.startsWith(`${nextNumber}/`))) {
    nextNumber++;
    suggestedNumber = `${nextNumber}`;
  }
  
  return suggestedNumber;
};

/**
 * Generates the next variation PTrab number (e.g., 4.1/2025/OM -> 4.2/2025/OM).
 * @param originalPTrabNumber The base PTrab number (e.g., '4/2025/OM').
 * @param existingNumbers Array of existing PTrab numbers.
 * @returns The next unique variation number.
 */
export const generateVariationPTrabNumber = (originalPTrabNumber: string, existingNumbers: string[]): string => {
  const parts = originalPTrabNumber.split('/');
  const baseNumberAndVariation = parts[0];
  const year = parts[1] || String(currentYear);

  const baseNumberMatch = baseNumberAndVariation.match(/^(\d+)/);
  const baseNumber = baseNumberMatch ? baseNumberMatch[1] : '';

  if (!baseNumber) return `1.1`;

  const variationNumbers = existingNumbers
    .filter(num => num.startsWith(`${baseNumber}.`) && num.includes(`/${year}`))
    .map(num => {
      const variationPart = num.split('/')[0].split('.')[1];
      return parseInt(variationPart);
    })
    .filter(num => !isNaN(num));

  const maxVariation = variationNumbers.length > 0 ? Math.max(...variationNumbers) : 0;
  return `${baseNumber}.${maxVariation + 1}`; // Retorna apenas o número base.variação
};

/**
 * Checks if a PTrab number already exists in the list.
 * @param numberToCheck The PTrab number to validate (e.g., '5/2025/OM').
 * @param existingNumbers Array of existing PTrab numbers.
 * @returns True if the number exists, false otherwise.
 */
export const isPTrabNumberDuplicate = (numberToCheck: string, existingNumbers: string[]): boolean => {
    return existingNumbers.includes(numberToCheck);
};

/**
 * Formats the final PTrab number: NUMBER/YEAR/OM_SIGLA
 * @param baseNumber The base number (e.g., '5' or '4.1').
 * @param omSigla The OM sigla (e.g., 'Cmdo 23ª Bda Inf Sl').
 * @returns The final formatted PTrab number (e.g., '5/2025/23ª Bda Inf Sl').
 */
export const formatFinalPTrabNumber = (baseNumber: string, omSigla: string): string => {
    const omSiglaCleaned = omSigla.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const omParts = omSiglaCleaned.split(' ').map(p => p.length > 3 ? p.substring(0, 3) : p).join('');
    
    // Usando a sigla da OM mais limpa, mas mantendo o formato original do usuário para a OM
    // Vamos usar a sigla completa da OM, mas remover caracteres especiais para o URL/caminho
    const omSuffix = omSigla.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').toUpperCase();
    
    return `${baseNumber}${yearSuffix}/${omSigla.toUpperCase()}`;
};