import { formatCurrency, formatNumber, formatUgNumber } from "./formatUtils";

// Interface para o registro carregado do DB (simplificada para utilitário)
export interface ClasseIRegistro {
  id: string;
  organizacao: string;
  ug: string;
  diasOperacao: number;
  faseAtividade?: string | null;
  
  omQS: string | null;
  ugQS: string | null;
  efetivo: number | null;
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
  
  quantidadeR2: number | null;
  quantidadeR3: number | null;
  categoria: 'RACAO_QUENTE' | 'RACAO_OPERACIONAL';
}

/**
 * Determina a preposição correta ('do' ou 'da') para o nome da OM.
 * Prioriza a detecção do indicador ordinal feminino (ª) ou 'RM'.
 */
export const getOmPreposition = (omName: string): 'do' | 'da' => {
    if (!omName) return 'do';
    
    const normalizedOm = omName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); // Remove acentos e normaliza
    
    // 1. Regra principal: Se contiver o indicador ordinal feminino 'ª' (ou 'a' após número)
    if (omName.includes('ª') || normalizedOm.match(/\d+\s*a\b/)) {
        return 'da';
    }
    
    // 2. Regra secundária: Se for uma Região Militar (RM)
    if (normalizedOm.includes('rm')) {
        return 'da';
    }
    
    // 3. Regra de exceção/padrão: Padrão é 'do'
    return 'do';
};


/**
 * Função auxiliar para formatar a fórmula de cálculo
 */
export const formatFormula = (
    efetivo: number,
    diasOperacao: number,
    nrRefInt: number,
    valorEtapa: number,
    diasEtapaSolicitada: number,
    tipo: 'complemento' | 'etapa',
    valorFinal: number
): string => {
    const E = efetivo;
    const D = diasOperacao;
    const R = nrRefInt;
    const V = valorEtapa;
    const DES = diasEtapaSolicitada;
    
    let formulaString = "";
    
    if (tipo === 'complemento') {
        // Fórmula: Efetivo x min(Ref. Int., 3) x (Valor Etapa / 3) x Dias de Atividade
        const minR = Math.min(R, 3);
        formulaString = `${formatNumber(E)} mil. x ${formatNumber(minR)} ref. int. x (${formatCurrency(V)} / 3) x ${formatNumber(D)} dias`;
    } else {
        // Fórmula: Efetivo x Valor Etapa x Dias de Etapa Solicitada
        formulaString = `${formatNumber(E)} mil. x ${formatCurrency(V)} x ${formatNumber(DES)} dias`;
    }
    
    return `${formulaString} = ${formatCurrency(valorFinal)}`;
};

/**
 * Função para formatar as fases de forma natural no texto
 */
export const formatFasesParaTexto = (faseCSV: string | undefined | null): string => {
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
 * Helper function to calculate days of requested stage (diasEtapaSolicitada)
 */
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

/**
 * Helper function to encapsulate calculation logic for Ração Quente
 */
export const calculateClasseICalculations = (
  efetivo: number | null,
  diasOperacao: number,
  nrRefInt: number,
  valorQS: number,
  valorQR: number
) => {
  const E = efetivo || 0;
  const D = diasOperacao || 0;
  const R = nrRefInt || 0;
  const VQS = valorQS || 0;
  const VQR = valorQR || 0;

  if (E <= 0 || D <= 0) {
    return {
      nrCiclos: 0,
      diasEtapaPaga: 0,
      diasEtapaSolicitada: 0,
      totalEtapas: 0,
      complementoQS: 0,
      etapaQS: 0,
      totalQS: 0,
      complementoQR: 0,
      etapaQR: 0,
      totalQR: 0,
    };
  }

  const diasEtapaSolicitada = calculateDiasEtapaSolicitada(D);
  
  const complementoQS = E * Math.min(R, 3) * (VQS / 3) * D;
  const etapaQS = E * VQS * diasEtapaSolicitada;
  const totalQS = complementoQS + etapaQS;

  const complementoQR = E * Math.min(R, 3) * (VQR / 3) * D;
  const etapaQR = E * VQR * diasEtapaSolicitada;
  const totalQR = complementoQR + etapaQR;

  return {
    nrCiclos: Math.ceil(D / 30),
    diasEtapaPaga: Math.ceil(D / 30) * 22, // Este campo não é usado na fórmula, mas mantido para referência
    diasEtapaSolicitada,
    totalEtapas: diasEtapaSolicitada + (R * D),
    complementoQS,
    etapaQS,
    totalQS,
    complementoQR,
    etapaQR,
    totalQR,
  };
};


/**
 * Gera a memória de cálculo formatada para Ração Quente (QS/QR).
 */
export const generateRacaoQuenteMemoriaCalculo = (registro: ClasseIRegistro): { qs: string, qr: string } => {
  const { organizacao, efetivo, diasOperacao, nrRefInt, valorQS, valorQR, calculos, faseAtividade } = registro;
  
  if (registro.categoria !== 'RACAO_QUENTE' || efetivo === null || valorQS === null || valorQR === null || nrRefInt === null) {
      return { qs: "Memória não aplicável.", qr: "" };
  }
  
  const E = efetivo;
  const D = diasOperacao;
  const R = nrRefInt;
  const VQS = valorQS;
  const VQR = valorQR;
  
  const diasEtapaSolicitada = calculos.diasEtapaSolicitada;
  const faseFormatada = formatFasesParaTexto(faseAtividade);
  
  // Lógica de pluralização
  const militarPlural = E === 1 ? 'militar' : 'militares';
  
  // Lógica de preposição
  const preposition = getOmPreposition(organizacao);
  
  // Memória QS (Quantitativo de Subsistência)
  const memoriaQS = `33.90.30 - Aquisição de Gêneros Alimentícios (QS) destinados à complementação de alimentação de ${E} ${militarPlural} ${preposition} ${organizacao}, durante ${D} dias de ${faseFormatada}.

Cálculo:
- Valor da Etapa (QS): ${formatCurrency(VQS)}.
- Nr Refeições Intermediárias: ${R}.
- Dias de Etapa Solicitada: ${formatNumber(diasEtapaSolicitada)} dias.
- Dias de Complemento de Etapa: ${formatNumber(D)} dias.

Fórmula do Complemento: [Efetivo x Nr Ref Int (máx 3) x Valor da Etapa/3 x Dias de Complemento de Etapa]
Fórmula da Etapa Solicitada: [Efetivo x Valor da etapa x Dias de Etapa Solicitada]

- Complemento de Etapa: ${formatFormula(E, D, R, VQS, 0, 'complemento', calculos.complementoQS)}.
- Etapa Solicitada: ${formatFormula(E, D, R, VQS, diasEtapaSolicitada, 'etapa', calculos.etapaQS)}.

Total QS: ${formatCurrency(calculos.totalQS)}.`;

  // Memória QR (Quantitativo de Reforço)
  const memoriaQR = `33.90.30 - Aquisição de Gêneros Alimentícios (QR) destinados à complementação de alimentação de ${E} ${militarPlural} ${preposition} ${organizacao}, durante ${D} dias de ${faseFormatada}.

Cálculo:
- Valor da Etapa (QR): ${formatCurrency(VQR)}.
- Nr Refeições Intermediárias: ${R}.
- Dias de Etapa Solicitada: ${formatNumber(diasEtapaSolicitada)} dias.
- Dias de Complemento de Etapa: ${formatNumber(D)} dias.

Fórmula do Complemento: [Efetivo x Nr Ref Int (máx 3) x Valor da Etapa/3 x Dias de Complemento de Etapa]
Fórmula da Etapa Solicitada: [Efetivo x Valor da etapa x Dias de Etapa Solicitada]

- Complemento de Etapa: ${formatFormula(E, D, R, VQR, 0, 'complemento', calculos.complementoQR)}.
- Etapa Solicitada: ${formatFormula(E, D, R, VQR, diasEtapaSolicitada, 'etapa', calculos.etapaQR)}.

Total QR: ${formatCurrency(calculos.totalQR)}.`;

  return { qs: memoriaQS, qr: memoriaQR };
};

/**
 * Gera a memória de cálculo formatada para Ração Operacional (R2/R3).
 */
export const generateRacaoOperacionalMemoriaCalculo = (registro: ClasseIRegistro): string => {
    if (registro.categoria !== 'RACAO_OPERACIONAL') {
        return "Memória não aplicável para Ração Quente.";
    }
    
    const { organizacao, efetivo, diasOperacao, quantidadeR2, quantidadeR3, faseAtividade } = registro;
    
    const E = efetivo || 0;
    const D = diasOperacao || 0;
    const R2 = quantidadeR2 || 0;
    const R3 = quantidadeR3 || 0;
    const totalRacoes = R2 + R3;
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    
    // Lógica de pluralização
    const militarPlural = E === 1 ? 'militar' : 'militares';
    const diaPlural = D === 1 ? 'dia' : 'dias';
    
    // Lógica de preposição
    const preposition = getOmPreposition(organizacao);

    // NOVO CABEÇALHO AJUSTADO COM 33.90.30
    const header = `33.90.30 - Fornecimento de Ração Operacional para atender ${formatNumber(E)} ${militarPlural} ${preposition} ${organizacao}, por até ${formatNumber(D)} ${diaPlural} de ${faseFormatada}, em caso de comprometimento do fluxo Cl I (QR/QS) ou de conduções de atividades descentralizada/afastadas de instalações militares.`;

    return `${header}

Quantitativo R2 (24h): ${formatNumber(R2)} un.
Quantitativo R3 (12h): ${formatNumber(R3)} un.

Total de Rções Operacionais: ${formatNumber(totalRacoes)} unidades.`;
};