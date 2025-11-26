export interface PrecoCombustivelResult {
  preco_diesel: number;
  preco_gasolina: number;
  fonte: string;
}

/**
 * Busca preços de combustíveis em uma API externa.
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
  // URL base da API real
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
    const response = await fetch(url);
    
    if (!response.ok) {
      // Tenta ler a mensagem de erro do corpo se disponível
      const errorBody = await response.json().catch(() => ({ message: `Erro HTTP: ${response.status}` }));
      throw new Error(errorBody.message || `Erro ao buscar preços. Status: ${response.status}`);
    }
    
    const data = await response.json();

    // Validação básica da resposta
    if (typeof data.preco_diesel !== 'number' || typeof data.preco_gasolina !== 'number') {
        throw new Error("Resposta da API inválida: Preços não são numéricos.");
    }

    return {
      preco_diesel: data.preco_diesel,
      preco_gasolina: data.preco_gasolina,
      fonte: data.fonte || "ANP - Fonte Desconhecida",
    };
  } catch (error) {
    console.error("Erro ao buscar preços de combustível:", error);
    // Lança um erro amigável para o usuário
    throw new Error("Falha ao conectar ou obter dados da API de preços de combustível. Verifique os parâmetros de consulta.");
  }
}