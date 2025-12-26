// Conteúdo simulado de src/lib/classeIUtils.ts (apenas a função relevante)

// ... (outras imports e tipos)

export const generateRacaoOperacionalMemoriaCalculo = (registro: {
    om: string;
    ug: string;
    r2_quantidade: number;
    r3_quantidade: number;
    efetivo: number;
    dias_operacao: number;
    fase_atividade: string;
}): string => {
    const { om, ug, r2_quantidade, r3_quantidade, efetivo, dias_operacao, fase_atividade } = registro;
    const totalRacoes = r2_quantidade + r3_quantidade;
    const faseFormatada = formatFasesParaTexto(fase_atividade); // Assumindo que formatFasesParaTexto está disponível

    return `33.90.30 – ração operacional para atender ${efetivo} militares, por até ${dias_operacao} dias, para ser utilizada na Operação de ${faseFormatada}, em caso de comprometimento do fluxo Cl I (QR/QS) ou de tarefas, descentralizadas, afastadas da(s) base(s) de apoio logístico.
OM de Destino: ${om} (UG: ${ug})

Quantitativo R2 (24h): ${formatNumber(r2_quantidade)} un.
Quantitativo R3 (12h): ${formatNumber(r3_quantidade)} un.

Total de Rações Operacionais: ${formatNumber(totalRacoes)} unidades.`; // CORRIGIDO: Rções -> Rações
};

// ... (restante do arquivo)