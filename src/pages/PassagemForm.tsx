// NOVO: Função auxiliar para realizar o cálculo completo
const calculatePassagemData = (formData: PassagemFormState, ptrabData: PTrabData | undefined) => {
    if (!ptrabData || formData.selected_trechos.length === 0) {
        console.log("CALC PASSAGEM: Retornando 0. Motivo: PTrab ou Trechos vazios.");
        return {
            totalGeral: 0,
            totalND33: 0,
            memoria: "Selecione pelo menos um trecho e preencha os dados de solicitação.",
        };
    }
    
    try {
        let totalGeral = 0;
        let totalND33 = 0;
        let memoria = "";
        
        formData.selected_trechos.forEach((trecho, index) => {
            // 1. Calcular o total do trecho
            const totalTrecho = calculateTrechoTotal(trecho);
            
            console.log(`Trecho ${index + 1}: Valor Unitário: ${trecho.valor_unitario}, Qtd: ${trecho.quantidade_passagens}, Total Trecho: ${totalTrecho}`); // DEBUG
            
            totalGeral += totalTrecho;
            totalND33 += totalTrecho; // ND 33.90.33 é o único para passagens
            
            // 2. Gerar memória para o trecho
            // ... (restante do código de memória)
            // ...
        });
        
        console.log(`CALC PASSAGEM: Total Geral Calculado: ${totalGeral}`); // DEBUG
        
        memoria += `\n==================================================\n`;
        memoria += `TOTAL GERAL SOLICITADO: ${formatCurrency(totalGeral)}\n`;
        memoria += `Efetivo: ${formData.efetivo} militares\n`;
        memoria += `==================================================\n`;
        
        return {
            totalGeral,
            totalND33,
            memoria,
        };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Erro desconhecido no cálculo.";
        console.error("Erro em calculatePassagemData:", e);
        return {
            totalGeral: 0,
            totalND33: 0,
            memoria: `Erro ao calcular: ${errorMessage}`,
        };
    }
};