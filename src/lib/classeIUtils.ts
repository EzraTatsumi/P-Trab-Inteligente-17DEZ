import { formatCurrency, formatNumber, formatUgNumber } from "./formatUtils";

// Interface para o registro carregado do DB
export interface ClasseIRegistro {
  id: string;
  categoria: 'RACAO_QUENTE' | 'RACAO_OPERACIONAL';
  organizacao: string;
  ug: string;
  diasOperacao: number;
  efetivo: number;
  faseAtividade: string;
  
  // Racao Quente fields
  omQS?: string;
  ugQS?: string;
  nrRefInt?: number;
  valorQS?: number;
  valorQR?: number;
  memoriaQSCustomizada?: string | null;
  memoriaQRCustomizada?: string | null;
  
  calculos: {
    totalQS: number;
    totalQR: number;
    nrCiclos: number;
    diasEtapaPaga: number;
    diasEtapaSolicitada: number;
    totalEtapas: number;
    complementoQS: number;
    etapaQS: number;
    complementoQR: number;
    etapaQR: number;
  };
  
  // Racao Operacional fields
  quantidadeR2?: number;
  quantidadeR3?: number;
}

interface ClasseICalculations {
  nrCiclos: number;
  diasEtapaPaga: number;
  diasEtapaSolicitada: number;
  totalEtapas: number;
  complementoQS: number;
  etapaQS: number;
  totalQS: number;
  complementoQR: number;
  etapaQR: number;
  totalQR: number;
}

/**
 * Determina a preposição correta ('do', 'da', 'de') para uma OM.
 * @param omName Nome da OM (sigla).
 * @returns A preposição correta.
 */
export const getOmPreposition = (omName: string): string => {
  if (!omName) return 'da';
  
  const lowerCaseName = omName.toLowerCase();
  
  // Casos comuns que usam 'do' ou 'da'
  if (lowerCaseName.includes('bda') || lowerCaseName.includes('rm') || lowerCaseName.includes('cm')) {
    return 'da';
  }
  
  // Casos que usam 'do'
  if (lowerCaseName.includes('batalhão') || lowerCaseName.includes('regimento') || lowerCaseName.includes('comando')) {
    return 'do';
  }
  
  // Padrão: se a sigla começar com número ou for genérica, usa 'da'
  return 'da';
};

/**
 * Calcula os valores de QS e QR para Ração Quente.
 */
export const calculateClasseICalculations = (
  efetivo: number,
  diasOperacao: number,
  nrRefInt: number,
  valorQS: number,
  valorQR: number
): ClasseICalculations => {
  if (efetivo <= 0 || diasOperacao <= 0) {
    return {
      nrCiclos: 0, diasEtapaPaga: 0, diasEtapaSolicitada: 0, totalEtapas: 0,
      complementoQS: 0, etapaQS: 0, totalQS: 0, complementoQR: 0, etapaQR: 0, totalQR: 0,
    };
  }

  // 1. Cálculo de Ciclos e Etapas
  const diasEtapaPaga = 1; // Sempre 1 dia pago por etapa
  const nrCiclos = 3 - nrRefInt; // 3 refeições totais - refeições intermediárias
  const diasEtapaSolicitada = diasOperacao * nrCiclos;
  const totalEtapas = efetivo * diasEtapaSolicitada;

  // 2. Cálculo de Valores
  const complementoQS = efetivo * diasOperacao * valorQS;
  const etapaQS = totalEtapas * valorQS;
  const totalQS = complementoQS + etapaQS;

  const complementoQR = efetivo * diasOperacao * valorQR;
  const etapaQR = totalEtapas * valorQR;
  const totalQR = complementoQR + etapaQR;

  return {
    nrCiclos,
    diasEtapaPaga,
    diasEtapaSolicitada,
    totalEtapas,
    complementoQS,
    etapaQS,
    totalQS,
    complementoQR,
    etapaQR,
    totalQR,
  };
};

/**
 * Formata a string de fases de atividade para exibição.
 */
export const formatFasesParaTexto = (faseAtividade: string | null | undefined): string => {
  if (!faseAtividade) return 'N/A';
  const fases = faseAtividade.split(';').map(f => f.trim()).filter(f => f);
  if (fases.length === 0) return 'N/A';
  return fases.join(', ');
};

/**
 * Gera a memória de cálculo para Ração Quente (QS e QR).
 */
export const generateRacaoQuenteMemoriaCalculo = (registro: ClasseIRegistro) => {
  const { efetivo, diasOperacao, nrRefInt, valorQS, valorQR, calculos, omQS, ugQS, organizacao, ug } = registro;
  
  const nrCiclos = 3 - (nrRefInt || 0);
  const diasEtapaSolicitada = diasOperacao * nrCiclos;
  const totalEtapas = efetivo * diasEtapaSolicitada;

  const qs = `
MEMÓRIA DE CÁLCULO - QUANTITATIVO DE SUBSISTÊNCIA (QS)
OM Destino: ${omQS} (UG: ${formatUgNumber(ugQS)})
Valor da Etapa QS: ${formatCurrency(valorQS || 0)}

1. Complemento de Etapa (Diário):
   Fórmula: Efetivo x Dias de Operação x Valor QS
   Cálculo: ${formatNumber(efetivo)} x ${diasOperacao} x ${formatCurrency(valorQS || 0)}
   Resultado: ${formatCurrency(calculos.complementoQS)}

2. Etapa a Solicitar (Refeições Intermediárias):
   Fórmula: Efetivo x Dias de Operação x Nº Ref. Intermediárias x Valor QS
   Cálculo: ${formatNumber(efetivo)} x ${diasOperacao} x ${nrCiclos} x ${formatCurrency(valorQS || 0)}
   Total de Etapas: ${formatNumber(totalEtapas)}
   Resultado: ${formatCurrency(calculos.etapaQS)}

TOTAL QS: ${formatCurrency(calculos.totalQS)}
  `.trim();

  const qr = `
MEMÓRIA DE CÁLCULO - QUANTITATIVO DE REFORÇO (QR)
OM Destino: ${organizacao} (UG: ${formatUgNumber(ug)})
Valor da Etapa QR: ${formatCurrency(valorQR || 0)}

1. Complemento de Etapa (Diário):
   Fórmula: Efetivo x Dias de Operação x Valor QR
   Cálculo: ${formatNumber(efetivo)} x ${diasOperacao} x ${formatCurrency(valorQR || 0)}
   Resultado: ${formatCurrency(calculos.complementoQR)}

2. Etapa a Solicitar (Refeições Intermediárias):
   Fórmula: Efetivo x Dias de Operação x Nº Ref. Intermediárias x Valor QR
   Cálculo: ${formatNumber(efetivo)} x ${diasOperacao} x ${nrCiclos} x ${formatCurrency(valorQR || 0)}
   Total de Etapas: ${formatNumber(totalEtapas)}
   Resultado: ${formatCurrency(calculos.etapaQR)}

TOTAL QR: ${formatCurrency(calculos.totalQR)}
  `.trim();

  return { qs, qr };
};

/**
 * Gera a memória de cálculo para Ração Operacional (R2 e R3).
 */
export const generateRacaoOperacionalMemoriaCalculo = (registro: ClasseIRegistro) => {
  const { efetivo, diasOperacao, quantidadeR2, quantidadeR3, organizacao, ug } = registro;
  const totalUnidades = (quantidadeR2 || 0) + (quantidadeR3 || 0);

  return `
MEMÓRIA DE CÁLCULO - RAÇÃO OPERACIONAL (R2/R3)
OM Destino: ${organizacao} (UG: ${formatUgNumber(ug)})
Efetivo Empregado: ${formatNumber(efetivo)} militares
Dias de Operação: ${diasOperacao} dias

1. Ração Operacional R2 (24h):
   Quantidade Solicitada: ${formatNumber(quantidadeR2 || 0)} unidades

2. Ração Operacional R3 (12h):
   Quantidade Solicitada: ${formatNumber(quantidadeR3 || 0)} unidades

TOTAL DE RAÇÕES OPERACIONAIS: ${formatNumber(totalUnidades)} unidades
(Nota: O valor monetário desta solicitação é considerado R$ 0,00 para fins de cálculo logístico interno.)
  `.trim();
};

/**
 * Formata a fórmula de cálculo para exibição no card de consolidação.
 */
export const formatFormula = (
  efetivo: number, 
  diasOperacao: number, 
  nrRefInt: number, 
  valorEtapa: number, 
  diasEtapaSolicitada: number, 
  tipo: 'complemento' | 'etapa', 
  resultado: number
): string => {
  const valorFormatado = formatCurrency(valorEtapa).replace('R$', '');
  const efetivoFormatado = formatNumber(efetivo);
  
  if (tipo === 'complemento') {
    // Complemento de Etapa (Diário)
    return `${efetivoFormatado} x ${diasOperacao} x ${valorFormatado} = ${formatCurrency(resultado)}`;
  } else {
    // Etapa a Solicitar (Refeições Intermediárias)
    const nrCiclos = 3 - nrRefInt;
    return `${efetivoFormatado} x ${diasOperacao} x ${nrCiclos} x ${valorFormatado} = ${formatCurrency(resultado)}`;
  }
};