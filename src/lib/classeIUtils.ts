import { formatCurrency, formatNumber, formatFasesParaTexto as formatFasesGeral } from "./formatUtils";

export interface ClasseIRegistro {
  id: string;
  categoria: 'RACAO_QUENTE' | 'RACAO_OPERACIONAL';
  organizacao: string;
  ug: string;
  diasOperacao: number;
  efetivo: number;
  faseAtividade: string | null;
  omQS?: string;
  ugQS?: string;
  nrRefInt?: number;
  valorQS?: number;
  valorQR?: number;
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
  quantidadeR2?: number;
  quantidadeR3?: number;
}

/**
 * Formata as fases da atividade para exibição textual amigável.
 */
export const formatFasesParaTexto = (faseString: string | null | undefined): string => {
    if (!faseString) return "N/A";
    return faseString.split(';').map(f => f.trim()).filter(f => f).join(', ');
};

/**
 * Calcula os valores de Classe I (Ração Quente).
 */
export function calculateClasseICalculations(
    efetivo: number, 
    diasOperacao: number, 
    nrRefInt: number, 
    valorQS: number, 
    valorQR: number
) {
    const nrCiclos = Math.floor(diasOperacao / 10);
    const diasRestantes = diasOperacao % 10;
    
    // Regra: a cada 10 dias, 3 dias são "Etapa Paga" (não gera custo de complemento)
    // O restante é "Etapa a Solicitar" (gera custo de complemento + etapa)
    const diasEtapaPaga = nrCiclos * 3;
    const diasEtapaSolicitada = diasOperacao - diasEtapaPaga;
    const totalEtapas = efetivo * diasEtapaSolicitada;

    // QS (Subsistência)
    const complementoQS = valorQS * 0.2; // 20% de complemento
    const etapaQS = valorQS * 0.8;      // 80% de etapa
    
    const totalQS = (totalEtapas * complementoQS) + (totalEtapas * etapaQS);

    // QR (Reforço)
    // Se nrRefInt for 2, dobra os valores de complemento e etapa
    const multiplicadorRef = nrRefInt === 2 ? 2 : 1;
    const complementoQR = (valorQR * 0.2) * multiplicadorRef;
    const etapaQR = (valorQR * 0.8) * multiplicadorRef;
    
    const totalQR = (totalEtapas * complementoQR) + (totalEtapas * etapaQR);

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
        totalQR
    };
}

/**
 * Formata a fórmula de cálculo para exibição na UI.
 */
export const formatFormula = (efetivo: number, dias: number, ref: number, valor: number, diasEtapa: number, tipo: 'complemento' | 'etapa', valorUnitario: number) => {
    const nrCiclos = Math.floor(dias / 10);
    const diasPaga = nrCiclos * 3;
    const diasSolicitada = dias - diasPaga;
    
    if (tipo === 'complemento') {
        return `${efetivo} mil. x ${diasSolicitada} dias x ${formatCurrency(valorUnitario)}`;
    }
    return `${efetivo} mil. x ${diasSolicitada} dias x ${formatCurrency(valorUnitario)}`;
};

/**
 * Gera a memória de cálculo para Ração Quente (QS e QR).
 */
export function generateRacaoQuenteMemoriaCalculo(registro: ClasseIRegistro): { qs: string, qr: string } {
    const { efetivo, diasOperacao, nrRefInt, valorQS, valorQR, calculos, organizacao, omQS } = registro;
    const fases = formatFasesParaTexto(registro.faseAtividade);
    
    const baseQS = `33.90.30 - Fornecimento de Quantitativo de Subsistência (QS) para atender ${efetivo} militares da OM, por até ${diasOperacao} dias de ${fases}.

Memória de Cálculo:
- Efetivo: ${efetivo} militares
- Período total: ${diasOperacao} dias
- Dias de Etapa Paga (Unidade): ${calculos.diasEtapaPaga} dias
- Dias de Etapa a Solicitar: ${calculos.diasEtapaSolicitada} dias
- Valor da Etapa (Diretriz): ${formatCurrency(valorQS || 0)}

Detalhamento Financeiro (QS):
a) Complemento de Etapa (20%): ${efetivo} x ${calculos.diasEtapaSolicitada} x ${formatCurrency(calculos.complementoQS)} = ${formatCurrency(calculos.totalEtapas * calculos.complementoQS)}
b) Etapa a Solicitar (80%): ${efetivo} x ${calculos.diasEtapaSolicitada} x ${formatCurrency(calculos.etapaQS)} = ${formatCurrency(calculos.totalEtapas * calculos.etapaQS)}

Valor Total Estimado para QS: ${formatCurrency(calculos.totalQS)}`;

    const baseQR = `33.90.30 - Fornecimento de Quantitativo de Reforço (QR) para atender ${efetivo} militares da OM, por até ${diasOperacao} dias de ${fases}, considerando ${nrRefInt} refeição(ões) intermediária(s).

Memória de Cálculo:
- Efetivo: ${efetivo} militares
- Período total: ${diasOperacao} dias
- Dias de Etapa a Solicitar: ${calculos.diasEtapaSolicitada} dias
- Valor da Etapa (Diretriz): ${formatCurrency(valorQR || 0)}
- Refeições Intermediárias: ${nrRefInt}

Detalhamento Financeiro (QR):
a) Complemento de Etapa (20%): ${efetivo} x ${calculos.diasEtapaSolicitada} x ${formatCurrency(calculos.complementoQR)} = ${formatCurrency(calculos.totalEtapas * calculos.complementoQR)}
b) Etapa a Solicitar (80%): ${efetivo} x ${calculos.diasEtapaSolicitada} x ${formatCurrency(calculos.etapaQR)} = ${formatCurrency(calculos.totalEtapas * calculos.etapaQR)}

Valor Total Estimado para QR: ${formatCurrency(calculos.totalQR)}`;

    return { qs: baseQS, qr: baseQR };
}

/**
 * Gera a memória de cálculo para Ração Operacional (R2/R3).
 */
export function generateRacaoOperacionalMemoriaCalculo(registro: ClasseIRegistro): string {
    const { efetivo, diasOperacao, organizacao, quantidadeR2, quantidadeR3 } = registro;
    const fases = formatFasesParaTexto(registro.faseAtividade);
    const totalUnidades = (quantidadeR2 || 0) + (quantidadeR3 || 0);
    
    // Nota: Usando Math.round e formatNumber(x, 0) para garantir que não haja decimais
    return `33.90.30 - Fornecimento de Ração Operacional para atender ${Math.round(efetivo)} militares da ${organizacao}, por até ${Math.round(diasOperacao)} dias de ${fases}, em caso de comprometimento do fluxo Cl I (QR/QS) ou de conduções de atividades descentralizadas/afastadas de instalações militares.

Quantitativo R2 (24h): ${formatNumber(quantidadeR2 || 0, 0)} un.
Quantitativo R3 (12h): ${formatNumber(quantidadeR3 || 0, 0)} un.

Total de Rações Operacionais: ${formatNumber(totalUnidades, 0)} unidades.`;
}