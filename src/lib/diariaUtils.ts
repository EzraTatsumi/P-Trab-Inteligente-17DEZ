// ... (código anterior)
// Tipo para as diretrizes operacionais (valores unitários)
type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

/**
// ... (código anterior)
    // 1. Cálculo dos dias de pagamento (dias_operacao - 0.5)
    const diasPagamento = Math.max(0, dias_operacao - 0.5);
// ... (código anterior)
    
    // 2. Cálculo da Taxa de Embarque
    let totalTaxaEmbarque = 0;
    if (is_aereo) { // Apenas calcula se for deslocamento aéreo
        const taxaEmbarqueUnitario = Number(diretrizes.taxa_embarque || 0);
        totalTaxaEmbarque = totalMilitares * taxaEmbarqueUnitario * nr_viagens;
    }
    
// ... (código anterior)
export const generateDiariaMemoriaCalculo = (
    data: DiariaData, 
    diretrizes: Partial<DiretrizOperacional>,
    calculos: ReturnType<typeof calculateDiariaTotals>
): string => {
    const { dias_operacao, destino, nr_viagens, local_atividade, organizacao, ug, is_aereo, fase_atividade } = data;
    const { totalDiariaBase, totalTaxaEmbarque, totalGeral, totalMilitares, calculosPorPosto } = calculos;
    
    const referenciaLegal = diretrizes.diaria_referencia_legal || 'Lei/Portaria [NÚMERO]';
// ... (código anterior)
    
    // 1. Detalhamento de Valores Unitários (incluindo Taxa de Embarque)
    // Sempre inclui a linha da Taxa de Embarque
    detalhamentoValores += `- Taxa de Embarque: ${formatCurrency(taxaEmbarqueUnitario)}/viagem.\n`;

    const diasPagamento = Math.max(0, dias_operacao - 0.5);
    const viagemPluralFormula = nr_viagens === 1 ? 'viagem' : 'viagens'; // Correção: Plural de Viagem

    calculosPorPosto.forEach(calc => {
        // 1. Detalhamento de Valores Unitários
        detalhamentoValores += `- ${calc.posto}: ${formatCurrency(calc.valorUnitario)}/dia.\n`;
        
        // 2. Detalhamento da Fórmula das Diárias
        const formulaPart1 = `(${calc.quantidade} ${calc.posto} x ${formatCurrency(calc.valorUnitario)}/dia)`;
        
        // CORREÇÃO AQUI: Pluralização de diasPagamento
        // Se for exatamente 0.5, usa 'dia'. Caso contrário, usa 'dias'.
        const diasPagamentoText = Math.abs(diasPagamento - 0.5) < 0.001 ? 'dia' : 'dias';
        
        const formulaPart2 = `${formatNumber(diasPagamento)} ${diasPagamentoText} x ${nr_viagens} ${viagemPluralFormula}`;
        
        detalhamentoFormulaDiarias += `- ${formulaPart1} x ${formulaPart2} = ${formatCurrency(calc.custoTotal)}.\n`;
    });
// ... (código restante)