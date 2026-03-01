import { formatCurrency, formatNumber } from "@/lib/formatUtils";

export interface ClasseIRegistro {
  id: string;
  categoria: 'RACAO_QUENTE' | 'RACAO_OPERACIONAL';
  organizacao: string;
  ug: string;
  diasOperacao: number;
  efetivo: number | null;
  faseAtividade: string | null;
  omQS?: string | null;
  ugQS?: string | null;
  nrRefInt: number | null;
  valorQS: number | null;
  valorQR: number | null;
  memoriaQSCustomizada?: string | null;
  memoriaQRCustomizada?: string | null;
  memoria_calculo_op_customizada?: string | null;
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
  quantidadeR2?: number | null;
  quantidadeR3?: number | null;
}

const getOmPreposition = (omName: string): 'do' | 'da' => {
  if (!omName) return 'do';
  const normalizedOm = omName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (omName.includes('ª') || normalizedOm.match(/\d+\s*a\b/)) return 'da';
  if (normalizedOm.includes('rm')) return 'da';
  return 'do';
};

export const formatFasesParaTexto = (faseCSV: string | undefined | null): string => {
  if (!faseCSV) return 'execução';
  const fases = faseCSV.split(';').map(f => f.trim()).filter(f => f);
  if (fases.length === 0) return 'execução';
  if (fases.length === 1) return fases[0];
  if (fases.length === 2) return `${fases[0]} e ${fases[1]}`;
  const ultimaFase = fases[fases.length - 1];
  const demaisFases = fases.slice(0, -1).join(', ');
  return `${demaisFases} e ${ultimaFase}`;
};

export const calculateDiasEtapaSolicitada = (diasOperacao: number): number => {
  const diasRestantesNoCiclo = diasOperacao % 30;
  const ciclosCompletos = Math.floor(diasOperacao / 30);
  if (diasRestantesNoCiclo <= 22 && diasOperacao >= 30) {
    return ciclosCompletos * 8;
  } else if (diasRestantesNoCiclo > 22) {
    return (diasRestantesNoCiclo - 22) + (ciclosCompletos * 8);
  } else {
    return 0;
  }
};

export function calculateClasseICalculations(
  efetivo: number | null,
  diasOperacao: number,
  nrRefInt: number | null,
  valorQS: number | null,
  valorQR: number | null
) {
  const E = efetivo || 0;
  const D = diasOperacao || 0;
  const R = nrRefInt || 0;
  const VQS = valorQS || 0;
  const VQR = valorQR || 0;

  const diasEtapaSolicitada = calculateDiasEtapaSolicitada(D);
  const minR = Math.min(R, 3);

  const complementoQS = E * minR * (VQS / 3) * D;
  const etapaQS = E * VQS * diasEtapaSolicitada;
  const totalQS = complementoQS + etapaQS;

  const complementoQR = E * minR * (VQR / 3) * D;
  const etapaQR = E * VQR * diasEtapaSolicitada;
  const totalQR = complementoQR + etapaQR;

  return {
    nrCiclos: Math.ceil(D / 30),
    diasEtapaPaga: Math.ceil(D / 30) * 22,
    diasEtapaSolicitada,
    totalEtapas: diasEtapaSolicitada + (minR * D),
    complementoQS,
    etapaQS,
    totalQS,
    complementoQR,
    etapaQR,
    totalQR,
  };
}

export const formatFormula = (
  efetivo: number,
  diasOperacao: number,
  nrRefInt: number,
  valorEtapa: number,
  diasEtapaSolicitada: number,
  tipo: 'complemento' | 'etapa',
  valorFinal: number
): string => {
  const militarPlural = efetivo === 1 ? 'mil.' : 'mil.';
  const diaPlural = diasOperacao === 1 ? 'dia' : 'dias';
  const minR = Math.min(nrRefInt, 3);

  if (tipo === 'complemento') {
    return `${formatNumber(efetivo, 0)} ${militarPlural} x ${formatNumber(minR, 0)} ref. int. x (${formatCurrency(valorEtapa)} / 3) x ${formatNumber(diasOperacao, 0)} ${diaPlural} = ${formatCurrency(valorFinal)}`;
  } else {
    const diasEtapaPlural = diasEtapaSolicitada === 1 ? 'dia' : 'dias';
    return `${formatNumber(efetivo, 0)} ${militarPlural} x ${formatCurrency(valorEtapa)} x ${formatNumber(diasEtapaSolicitada, 0)} ${diasEtapaPlural} = ${formatCurrency(valorFinal)}`;
  }
};

export function generateRacaoQuenteMemoriaCalculo(registro: ClasseIRegistro): { qs: string, qr: string } {
  const { efetivo, diasOperacao, nrRefInt, valorQS, valorQR, calculos, organizacao, faseAtividade } = registro;

  if (!efetivo || valorQS === null || valorQR === null || nrRefInt === null) {
    return { qs: "Dados incompletos.", qr: "" };
  }

  const faseFormatada = formatFasesParaTexto(faseAtividade);
  const preposition = getOmPreposition(organizacao);
  const militarPlural = efetivo === 1 ? 'militar' : 'militares';
  const diaPlural = diasOperacao === 1 ? 'dia' : 'dias';
  const diasEtapaSolicitadaPlural = calculos.diasEtapaSolicitada === 1 ? 'dia' : 'dias';

  const qs = `33.90.30 - Aquisição de Gêneros Alimentícios (QS) destinados à complementação de alimentação de ${formatNumber(efetivo, 0)} ${militarPlural} ${preposition} ${organizacao}, durante ${formatNumber(diasOperacao, 0)} ${diaPlural} de ${faseFormatada}.

Cálculo:

Valor da Etapa (QS): ${formatCurrency(valorQS)}.

Nr Refeições Intermediárias: ${formatNumber(nrRefInt, 0)}.

Dias de Etapa Solicitada: ${formatNumber(calculos.diasEtapaSolicitada, 0)} ${diasEtapaSolicitadaPlural}.

Dias de Complemento de Etapa: ${formatNumber(diasOperacao, 0)} ${diaPlural}.

Fórmula do Complemento: [Efetivo x Nr Ref Int (máx 3) x Valor da Etapa/3 x Dias de Complemento de Etapa]
Fórmula da Etapa Solicitada: [Efetivo x Valor da etapa x Dias de Etapa Solicitada]

Complemento de Etapa: ${formatFormula(efetivo, diasOperacao, nrRefInt, valorQS, 0, 'complemento', calculos.complementoQS)}

Etapa Solicitada: ${formatFormula(efetivo, diasOperacao, nrRefInt, valorQS, calculos.diasEtapaSolicitada, 'etapa', calculos.etapaQS)}

Total QS: ${formatCurrency(calculos.totalQS)}.`;

  const qr = `33.90.30 - Aquisição de Gêneros Alimentícios (QR) destinados à complementação de alimentação de ${formatNumber(efetivo, 0)} ${militarPlural} ${preposition} ${organizacao}, durante ${formatNumber(diasOperacao, 0)} ${diaPlural} de ${faseFormatada}.

Cálculo:

Valor da Etapa (QR): ${formatCurrency(valorQR)}.

Nr Refeições Intermediárias: ${formatNumber(nrRefInt, 0)}.

Dias de Etapa Solicitada: ${formatNumber(calculos.diasEtapaSolicitada, 0)} ${diasEtapaSolicitadaPlural}.

Dias de Complemento de Etapa: ${formatNumber(diasOperacao, 0)} ${diaPlural}.

Fórmula do Complemento: [Efetivo x Nr Ref Int (máx 3) x Valor da Etapa/3 x Dias de Complemento de Etapa]
Fórmula da Etapa Solicitada: [Efetivo x Valor da etapa x Dias de Etapa Solicitada]

Complemento de Etapa: ${formatFormula(efetivo, diasOperacao, nrRefInt, valorQR, 0, 'complemento', calculos.complementoQR)}

Etapa Solicitada: ${formatFormula(efetivo, diasOperacao, nrRefInt, valorQR, calculos.diasEtapaSolicitada, 'etapa', calculos.etapaQR)}

Total QR: ${formatCurrency(calculos.totalQR)}.`;

  return { qs, qr };
}

export function generateRacaoOperacionalMemoriaCalculo(registro: ClasseIRegistro): string {
  const { efetivo, diasOperacao, organizacao, quantidadeR2, quantidadeR3, faseAtividade } = registro;
  const E = efetivo || 0;
  const D = diasOperacao || 0;
  const R2 = quantidadeR2 || 0;
  const R3 = quantidadeR3 || 0;
  const totalRacoes = R2 + R3;
  const faseFormatada = formatFasesParaTexto(faseAtividade);
  const militarPlural = E === 1 ? 'militar' : 'militares';
  const diaPlural = D === 1 ? 'dia' : 'dias';
  const preposition = getOmPreposition(organizacao);

  const header = `33.90.30 - Fornecimento de Ração Operacional para atender ${formatNumber(E, 0)} ${militarPlural} ${preposition} ${organizacao}, por até ${formatNumber(D, 0)} ${diaPlural} de ${faseFormatada}, em caso de comprometimento do fluxo Cl I (QR/QS) ou de conduções de atividades descentralizadas/afastadas de instalações militares.`;
  const racaoPlural = totalRacoes === 1 ? 'Ração Operacional' : 'Rações Operacionais';
  const unidadePlural = totalRacoes === 1 ? 'unidade' : 'unidades';

  return `${header}

Quantitativo R2 (24h): ${formatNumber(R2, 0)} un.
Quantitativo R3 (12h): ${formatNumber(R3, 0)} un.

Total de ${racaoPlural}: ${formatNumber(totalRacoes, 0)} ${unidadePlural}.`;
}