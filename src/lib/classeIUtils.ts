import { formatCurrency, formatNumber } from "./formatUtils";

// Interface para o registro carregado do DB (ou consolidado)
export interface ClasseIRegistro {
  id: string;
  organizacao: string;
  ug: string;
  diasOperacao: number;
  faseAtividade: string | null;
  categoria: 'RACAO_QUENTE' | 'RACAO_OPERACIONAL';
  
  // Racao Quente fields
  omQS: string | null;
  ugQS: string | null;
  efetivo: number;
  nrRefInt: number | null;
  valorQS: number | null;
  valorQR: number | null;
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
  quantidadeR2: number;
  quantidadeR3: number;
}

/**
 * Calcula os valores monetários e logísticos para Ração Quente (QS/QR).
 */
export const calculateClasseICalculations = (
  efetivo: number,
  diasOperacao: number,
  nrRefInt: number,
  valorQS: number,
  valorQR: number
) => {
  if (efetivo <= 0 || diasOperacao <= 0 || nrRefInt <= 0) {
    return {
      nrCiclos: 0, diasEtapaPaga: 0, diasEtapaSolicitada: 0, totalEtapas: 0,
      complementoQS: 0, etapaQS: 0, totalQS: 0, complementoQR: 0, etapaQR: 0, totalQR: 0,
    };
  }

  // 1. Cálculo de Ciclos e Etapas
  const nrCiclos = nrRefInt; // 1, 2 ou 3
  const diasEtapaPaga = Math.floor(diasOperacao / 30) * 30; // Múltiplo de 30
  const diasEtapaSolicitada = diasOperacao - diasEtapaPaga;
  const totalEtapas = Math.ceil(diasOperacao / 30);

  // 2. Cálculo do QS (Quantitativo de Subsistência - ND 33.90.30)
  // QS = Efetivo x (Dias Operação - Dias Etapa Paga) x Valor QS
  const complementoQS = efetivo * diasEtapaSolicitada * valorQS;
  // Etapa QS = Efetivo x Dias Etapa Paga x Valor QS
  const etapaQS = efetivo * diasEtapaPaga * valorQS;
  const totalQS = complementoQS + etapaQS;

  // 3. Cálculo do QR (Quantitativo de Reforço - ND 33.90.30)
  // QR = Efetivo x (Dias Operação - Dias Etapa Paga) x Valor QR
  const complementoQR = efetivo * diasEtapaSolicitada * valorQR;
  // Etapa QR = Efetivo x Dias Etapa Paga x Valor QR
  const etapaQR = efetivo * diasEtapaPaga * valorQR;
  const totalQR = complementoQR + etapaQR;

  return {
    nrCiclos,
    diasEtapaPaga,
    diasEtapaSolicitada,
    totalEtapas,
    complementoQS: parseFloat(complementoQS.toFixed(2)),
    etapaQS: parseFloat(etapaQS.toFixed(2)),
    totalQS: parseFloat(totalQS.toFixed(2)),
    complementoQR: parseFloat(complementoQR.toFixed(2)),
    etapaQR: parseFloat(etapaQR.toFixed(2)),
    totalQR: parseFloat(totalQR.toFixed(2)),
  };
};

/**
 * Formata as fases de atividade para exibição em texto.
 */
export const formatFasesParaTexto = (faseCSV: string | null | undefined): string => {
  if (!faseCSV) return 'operação';
  
  const fases = faseCSV.split(';').map(f => f.trim()).filter(f => f);
  
  if (fases.length === 0) return 'operação';
  if (fases.length === 1) return fases[0];
  if (fases.length === 2) return `${fases[0]} e ${fases[1]}`;
  
  const ultimaFase = fases[fases.length - 1];
  const demaisFases = fases.slice(0, -1).join(', ');
  return `${demaisFases} e ${ultimaFase}`;
};

/**
 * Gera a memória de cálculo para Ração Quente (QS e QR).
 */
export const generateRacaoQuenteMemoriaCalculo = (registro: ClasseIRegistro): { qs: string, qr: string } => {
  const { efetivo, diasOperacao, nrRefInt, valorQS, valorQR, omQS, ugQS, organizacao, ug, faseAtividade, calculos } = registro;
  
  const faseFormatada = formatFasesParaTexto(faseAtividade);
  const nrRefIntDisplay = nrRefInt || 1;
  const valorQSDisplay = valorQS || 0;
  const valorQRDisplay = valorQR || 0;
  
  const diasEtapaSolicitada = calculos.diasEtapaSolicitada;
  const diasEtapaPaga = calculos.diasEtapaPaga;
  
  const totalGeral = calculos.totalQS + calculos.totalQR;

  // --- Memória QS ---
  const qs = `33.90.30 – Quantitativo de Subsistência (QS) para atender ${efetivo} militares, por ${diasOperacao} dias de ${faseFormatada}, com ${nrRefIntDisplay} refeição intermediária.
OM de Destino do Recurso: ${omQS} (UG: ${ugQS})

Valor Unitário QS (Diretriz): ${formatCurrency(valorQSDisplay)}

Cálculo:
1. Complemento de Etapa (Dias não pagos):
   Fórmula: ${efetivo} mil x ${diasEtapaSolicitada} dias x ${formatCurrency(valorQSDisplay)} = ${formatCurrency(calculos.complementoQS)}
2. Etapa a Solicitar (Dias pagos):
   Fórmula: ${efetivo} mil x ${diasEtapaPaga} dias x ${formatCurrency(valorQSDisplay)} = ${formatCurrency(calculos.etapaQS)}

Total QS: ${formatCurrency(calculos.totalQS)}`;

  // --- Memória QR ---
  const qr = `33.90.30 – Quantitativo de Reforço (QR) para atender ${efetivo} militares, por ${diasOperacao} dias de ${faseFormatada}.
OM de Destino do Recurso: ${organizacao} (UG: ${ug})

Valor Unitário QR (Diretriz): ${formatCurrency(valorQRDisplay)}

Cálculo:
1. Complemento de Etapa (Dias não pagos):
   Fórmula: ${efetivo} mil x ${diasEtapaSolicitada} dias x ${formatCurrency(valorQRDisplay)} = ${formatCurrency(calculos.complementoQR)}
2. Etapa a Solicitar (Dias pagos):
   Fórmula: ${efetivo} mil x ${diasEtapaPaga} dias x ${formatCurrency(valorQRDisplay)} = ${formatCurrency(calculos.etapaQR)}

Total QR: ${formatCurrency(calculos.totalQR)}

Valor Total Ração Quente (QS + QR): ${formatCurrency(totalGeral)}`;

  return { qs, qr };
};

/**
 * Gera a memória de cálculo para Ração Operacional (R2/R3).
 */
export const generateRacaoOperacionalMemoriaCalculo = (registro: Pick<ClasseIRegistro, 'organizacao' | 'ug' | 'efetivo' | 'diasOperacao' | 'faseAtividade' | 'quantidadeR2' | 'quantidadeR3'>): string => {
    const { organizacao, ug, efetivo, diasOperacao, faseAtividade, quantidadeR2, quantidadeR3 } = registro;
    const totalRacoes = quantidadeR2 + quantidadeR3;
    const faseFormatada = formatFasesParaTexto(faseAtividade);

    // CORREÇÃO: "Rações" estava faltando o 'a'
    return `33.90.30 – Ração Operacional de Combate para atender ${efetivo} militares, por até ${diasOperacao} dias, para ser utilizada na Operação de ${faseFormatada}, em caso de comprometimento do fluxo Cl I (QR/QS) ou de tarefas, descentralizadas, afastadas da(s) base(s) de apoio logístico.
OM de Destino: ${organizacao} (UG: ${ug})

Quantitativo R2 (24h): ${formatNumber(quantidadeR2)} un.
Quantitativo R3 (12h): ${formatNumber(quantidadeR3)} un.

Total de Rações Operacionais: ${formatNumber(totalRacoes)} unidades.`;
};

/**
 * Helper para formatar a fórmula de cálculo para exibição no formulário.
 */
export const formatFormula = (
  efetivo: number,
  diasOperacao: number,
  nrRefInt: number,
  valor: number,
  diasEtapaSolicitada: number,
  tipo: 'complemento' | 'etapa',
  resultado: number
): string => {
  const diasEtapaPaga = diasOperacao - diasEtapaSolicitada;
  const valorFormatado = formatCurrency(valor);

  if (tipo === 'complemento') {
    return `${efetivo} mil x ${diasEtapaSolicitada} dias x ${valorFormatado} = ${formatCurrency(resultado)}`;
  } else if (tipo === 'etapa') {
    return `${efetivo} mil x ${diasEtapaPaga} dias x ${valorFormatado} = ${formatCurrency(resultado)}`;
  }
  return '';
};