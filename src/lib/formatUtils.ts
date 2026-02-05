/**
 * Converte um valor numérico (string ou number) para o formato de moeda brasileira (R$ X.XXX,XX).
 * @param value O valor numérico.
 * @returns A string formatada.
 */
export const formatCurrency = (value: number): string => {
    if (typeof value !== 'number' || isNaN(value)) {
        return 'R$ 0,00';
    }
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

/**
 * Formata um valor numérico para o formato de número brasileiro (X.XXX,XX).
 * @param value O valor numérico.
 * @param decimals Número de casas decimais (padrão 2).
 * @returns A string formatada.
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
    if (typeof value !== 'number' || isNaN(value)) {
        return '0,00';
    }
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
};

/**
 * Remove todos os caracteres não numéricos de uma string.
 * @param value A string de entrada.
 * @returns A string contendo apenas dígitos.
 */
export const numberToRawDigits = (value: string | number): string => {
    if (typeof value === 'number') {
        // Converte o número para string, tratando o ponto decimal
        value = value.toFixed(2).replace('.', ',');
    }
    return value.replace(/\D/g, '');
};

/**
 * Formata uma string de dígitos brutos para o formato de moeda (ex: 12345 -> 123,45).
 * @param rawDigits String contendo apenas dígitos.
 * @returns Um objeto com o valor numérico e a string formatada.
 */
export const formatCurrencyInput = (rawDigits: string): { numericValue: number, digits: string, formatted: string } => {
    const digits = rawDigits.replace(/\D/g, '');
    
    let numericValue = 0;
    let formatted = '0,00';

    if (digits.length > 0) {
        // Adiciona zeros à esquerda se necessário (mínimo 3 dígitos para centavos)
        const paddedDigits = digits.padStart(3, '0');
        
        // Separa a parte inteira e decimal
        const integerPart = paddedDigits.slice(0, -2);
        const decimalPart = paddedDigits.slice(-2);
        
        // Formata a parte inteira com separador de milhares
        const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        
        formatted = `${formattedInteger},${decimalPart}`;
        
        // Calcula o valor numérico real
        numericValue = parseInt(integerPart) + parseInt(decimalPart) / 100;
    }

    return {
        numericValue,
        digits,
        formatted,
    };
};

/**
 * Converte uma string de entrada formatada (ex: '1.250,00') para um número.
 * @param input A string de entrada.
 * @returns O valor numérico.
 */
export const parseInputToNumber = (input: string): number => {
    if (!input) return 0;
    // Remove separadores de milhar (pontos) e substitui a vírgula decimal por ponto
    const cleanedInput = input.replace(/\./g, '').replace(',', '.');
    const numberValue = parseFloat(cleanedInput);
    return isNaN(numberValue) ? 0 : numberValue;
};

/**
 * Formata um código numérico (como UASG ou CODUG) no padrão XXX.XXX.
 * Limita a 6 dígitos e insere o ponto após o terceiro dígito.
 * @param code A string do código (apenas dígitos).
 * @returns A string formatada.
 */
export const formatCodug = (code: string): string => {
    // 1. Remove tudo que não for dígito
    const rawDigits = code.replace(/\D/g, '');
    
    // 2. Limita a 6 dígitos
    const limitedDigits = rawDigits.slice(0, 6);

    if (limitedDigits.length <= 3) {
        return limitedDigits;
    }

    // 3. Aplica a máscara XXX.XXX
    const part1 = limitedDigits.slice(0, 3);
    const part2 = limitedDigits.slice(3);

    return `${part1}.${part2}`;
};