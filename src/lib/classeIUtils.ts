import { formatCurrency, formatNumber, formatFasesParaTexto as formatFasesGeral } from "./formatUtils";

/**
 * Interface para os cálculos de um registro de Classe I
 */
export interface CalculosClasseI {
  valorQS: number;
  complementoQS: number;
  etapaQS: number;
  totalQS: number;
  valorQR: number;
  complementoQR: number;
  etapaQR: number;
  totalQR: number;
  totalGeral: number;
}

/**
 * Interface para um registro calculado de Classe I
 */
export interface RegistroCalculadoClasseI {
  id?: string;
  organizacao: string;
  ug: string;
  efetivo: number;
  dias_operacao: number;
  nr_ref_int: number;
  categoria: string;
  calculos: CalculosClasseI;
  fase_atividade: string | string[];
}

/**
 * Formata as fases de atividade para exibição textual
 */
export const formatarFaseParaExibicao = (fase: string | string[] | null | undefined): string => {
  return formatFasesGeral(fase);
};

/**
 * Formata um valor de etapa/complemento para exibição
 */
export const formatarValorMonetario = (valor: number): string => {
  return formatCurrency(valor);
};