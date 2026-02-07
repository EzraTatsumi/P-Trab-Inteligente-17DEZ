import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata um valor numérico como moeda brasileira (R$).
 * @param value O valor a ser formatado.
 * @returns String formatada (ex: R$ 1.234,56).
 */
export function formatCurrency(value: number | string | null | undefined): string {
    if (value === null || value === undefined) return 'R$ 0,00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'R$ 0,00';

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(num);
}

/**
 * Alias para formatCurrency, usado em alguns componentes que esperam formatNumber.
 * Deve ser removido após a refatoração completa.
 */
export const formatNumber = formatCurrency;

/**
 * Formata uma string de data (ISO ou YYYY-MM-DD) para DD/MM/YYYY.
 * @param dateString A string de data.
 * @returns String formatada (ex: 31/12/2023) ou 'N/A'.
 */
export function formatDate(dateString: string | null | undefined): string {
    if (!dateString || dateString === 'N/A') return 'N/A';
    try {
        // Tenta parsear a data. Se for YYYY-MM-DD, o new Date() funciona.
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'N/A';
        }
        return format(date, 'dd/MM/yyyy', { locale: ptBR });
    } catch (e) {
        return 'N/A';
    }
}

/**
 * Formata um código de UG (Unidade Gestora) para o padrão XXX.XXX.
 * @param codug O código da UG (string ou number).
 * @returns String formatada (ex: 160.170).
 */
export function formatCodug(codug: string | number | null | undefined): string {
    if (!codug) return 'N/A';
    const str = String(codug).replace(/\D/g, '').padStart(6, '0');
    return str.replace(/(\d{3})(\d{3})/, '$1.$2');
}

/**
 * Formata um número de Pregão no padrão X.XXX/AA, removendo zeros à esquerda do número principal.
 * Espera o formato '000.001/24' e retorna '1/24' ou '1.001/24'.
 * @param pregaoFormatado O pregão formatado (ex: '000.001/24').
 * @returns String formatada (ex: '1/24').
 */
export function formatPregao(pregaoFormatado: string): string {
    if (!pregaoFormatado || pregaoFormatado === 'N/A') return 'N/A';

    // Exemplo: '000.001/24'
    const parts = pregaoFormatado.split('/');
    if (parts.length !== 2) return pregaoFormatado;

    const numeroCompleto = parts[0].replace(/\./g, ''); // '000001'
    const ano = parts[1]; // '24'

    // Remove zeros à esquerda do número completo
    const numeroSemZeros = numeroCompleto.replace(/^0+/, ''); // '1'

    if (!numeroSemZeros) {
        // Caso seja '000.000/24', retorna '0/24'
        return `0/${ano}`;
    }

    // Reinsere o ponto de milhar, se necessário
    if (numeroSemZeros.length > 3) {
        const parte1 = numeroSemZeros.slice(0, -3);
        const parte2 = numeroSemZeros.slice(-3);
        return `${parte1}.${parte2}/${ano}`;
    }

    return `${numeroSemZeros}/${ano}`;
}