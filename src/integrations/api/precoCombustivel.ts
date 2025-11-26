export interface PrecoCombustivelResult {
  preco_diesel: number;
  preco_gasolina: number;
  fonte: string;
}

/**
 * Busca preços de combustíveis em uma API externa.
 * Esta implementação simula uma chamada HTTP real para a API.
 * @param ambito O âmbito da consulta ('Nacional', 'Estadual', 'Municipal').
 * @param nomeLocal O nome do estado ou município (se aplicável).
 * @param dataInicio Data de início da consulta.
 * @param dataFim Data de fim da consulta.
 * @returns Os preços médios de diesel e gasolina e a fonte da consulta.
 */
export async function fetchPrecosCombustivel(
  ambito: 'Nacional' | 'Estadual' | 'Municipal',
  nomeLocal: string | undefined,
  dataInicio: string,
  dataFim: string
): Promise<PrecoCombustivelResult> {
  // URL base da API (ajuste conforme o endpoint real)
  const API_BASE_URL = 'https://api-preco-combustivel.onrender.com/api/v1/prices';
  
  // Construção dos parâmetros de consulta
  const params = new URLSearchParams({
    ambito: ambito,
    data_inicio: dataInicio,
    data_fim: dataFim,
  });

  if (nomeLocal) {
    params.append('local', nomeLocal);
  }

  const url = `${API_BASE_URL}?${params.toString()}`;

  try {
    // Simulação de chamada fetch (substitua por fetch(url) para produção)
    // const response = await fetch(url);
    // if (!response.ok) {
    //   throw new Error(`Erro HTTP: ${response.status}`);
    // }
    // const data = await response.json();
    
    // --- Lógica de Mock para simular a resposta da API real ---
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let dieselPrice = 6.50;
    let gasolinePrice = 5.80;
    let source = "ANP - Nacional (Simulado)";

    if (ambito === 'Estadual' && nomeLocal?.toLowerCase().includes('amazonas')) {
      dieselPrice = 7.10;
      gasolinePrice = 6.20;
      source = "ANP - Estadual (Simulado)";
    } else if (ambito === 'Municipal' && nomeLocal?.toLowerCase().includes('manaus')) {
      dieselPrice = 7.25;
      gasolinePrice = 6.35;
      source = "ANP - Municipal (Simulado)";
    } else if (ambito === 'Nacional') {
      // Mantém os valores padrão
    } else {
      // Fallback para valores genéricos se o local não for reconhecido
      dieselPrice = 6.80;
      gasolinePrice = 6.00;
      source = "ANP - Genérico (Simulado)";
    }
    
    const data = {
        preco_diesel: dieselPrice,
        preco_gasolina: gasolinePrice,
        fonte: source,
    };
    // --- Fim da Lógica de Mock ---

    return {
      preco_diesel: data.preco_diesel,
      preco_gasolina: data.preco_gasolina,
      fonte: data.fonte || "ANP - Fonte Desconhecida",
    };
  } catch (error) {
    console.error("Erro ao buscar preços de combustível:", error);
    throw new Error("Falha ao conectar com a API de preços de combustível.");
  }
}