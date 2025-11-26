export interface PrecoCombustivelResult {
  preco_diesel: number;
  preco_gasolina: number;
  fonte: string;
}

/**
 * Simula a chamada à API externa de preços de combustíveis.
 * NOTA: Esta é uma implementação MOCK. Substitua a lógica interna
 * pela chamada 'fetch' real para a API externa.
 */
export async function fetchPrecosCombustivel(
  ambito: 'Nacional' | 'Estadual' | 'Municipal',
  nomeLocal: string | undefined,
  dataInicio: string,
  dataFim: string
): Promise<PrecoCombustivelResult> {
  // Simulação de delay de rede
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Lógica MOCK: Retorna preços diferentes baseados no âmbito
  let dieselPrice = 6.50;
  let gasolinePrice = 5.80;
  let source = "API Nacional (Mock)";

  if (ambito === 'Estadual' && nomeLocal?.toLowerCase().includes('amazonas')) {
    dieselPrice = 7.10;
    gasolinePrice = 6.20;
    source = "API Estadual (Mock)";
  } else if (ambito === 'Municipal' && nomeLocal?.toLowerCase().includes('manaus')) {
    dieselPrice = 7.25;
    gasolinePrice = 6.35;
    source = "API Municipal (Mock)";
  }

  return {
    preco_diesel: dieselPrice,
    preco_gasolina: gasolinePrice,
    fonte: source,
  };
}