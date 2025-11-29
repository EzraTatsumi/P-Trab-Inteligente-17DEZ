const currentYear = new Date().getFullYear();
const yearSuffix = `/${currentYear}`;

/**
 * Gera o próximo número sequencial base do PTrab para o ano atual (ex: 5/2025).
 * Ignora variações (ex: 4.1/2025).
 * 
 * @param existingNumbers Array de números de PTrab existentes (ex: ['1/2025', '4.1/2025']).
 * @returns O próximo número base único no formato 'NUMERO/ANO'.
 */
export const generateUniquePTrabNumber = (existingNumbers: string[]): string => {
  const currentYearStr = String(currentYear);
  
  // 1. Encontrar o maior número base existente para o ano atual
  const numbersForCurrentYear = existingNumbers
    .filter(num => num.endsWith(`/${currentYearStr}`) && !num.includes('.')) // Filtra números base para o ano atual
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
 * Gera o próximo número de variação do PTrab (ex: 4/2025 -> 4.1/2025, 4.1/2025 -> 4.2/2025).
 * 
 * @param originalPTrabNumber O número base do PTrab (ex: '4/2025').
 * @param existingNumbers Array de números de PTrab existentes.
 * @returns O próximo número de variação único no formato 'NUMERO.VARIAÇÃO/ANO'.
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
 * Verifica se um número de PTrab já existe na lista.
 * 
 * @param numberToCheck O número do PTrab a ser validado.
 * @param existingNumbers Array de números de PTrab existentes.
 * @returns True se o número existir, false caso contrário.
 */
export const isPTrabNumberDuplicate = (numberToCheck: string, existingNumbers: string[]): boolean => {
    return existingNumbers.includes(numberToCheck);
};