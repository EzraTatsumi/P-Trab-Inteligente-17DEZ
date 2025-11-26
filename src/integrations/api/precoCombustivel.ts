export interface PrecoCombustivelResult {
  preco_diesel: number;
  preco_gasolina: number;
  fonte: string;
}

const SUPABASE_PROJECT_ID = 'fpwwljcortcssldjqluy';
const PETROBRAS_SCRAPING_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/fetch-petrobras-prices`;
const ANP_API_BASE_URL = 'https://api-preco-combustivel.onrender.com/api/v1/prices';

/**
 * Busca preços de combustíveis.
 * Usa Web Scraping (Edge Function) para âmbito Nacional (Petrobras).
 * Usa API Externa (ANP) para âmbitos Estadual/Municipal.
 * 
 * @param ambito O âmbito da consulta ('Nacional', 'Estadual', 'Municipal').
 * @param nomeLocal O nome do estado ou município (se aplicável).
 * @param dataInicio Data de início da consulta (usada apenas para API ANP).
 * @param dataFim Data de fim da consulta (usada apenas para API ANP).
 * @returns Os preços médios de diesel e gasolina e a fonte da consulta.
 */
export async function fetchPrecosCombustivel(
  ambito: 'Nacional' | 'Estadual' | 'Municipal',
  nomeLocal: string | undefined,
  dataInicio: string,
  dataFim: string
): Promise<PrecoCombustivelResult> {
  
  let url: string;
  let headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (ambito === 'Nacional') {
    // 1. Usar Web Scraping (Edge Function) para Nacional
    url = PETROBRAS_SCRAPING_URL;
    
    // Adicionar a chave anon para invocar a função
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwd3dsamNvcnRjc3NsZGpxbHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwOTQxNzUsImV4cCI6MjA3OTY3MDE3NX0.zQbdsORYnLLTSSedDqwc6YJidVoeueYRvrdearjFvr0';
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    
  } else {
    // 2. Usar API Externa (ANP) para Estadual/Municipal
    const params = new URLSearchParams({
      ambito: ambito,
      data_inicio: dataInicio,
      data_fim: dataFim,
    });

    if (nomeLocal) {
      params.append('local', nomeLocal);
    }
    url = `${ANP_API_BASE_URL}?${params.toString()}`;
  }

  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: `Erro HTTP: ${response.status}` }));
      throw new Error(errorBody.error || errorBody.message || `Erro ao buscar preços. Status: ${response.status}`);
    }
    
    const data = await response.json();

    if (typeof data.preco_diesel !== 'number' || typeof data.preco_gasolina !== 'number') {
        throw new Error("Resposta da API inválida: Preços não são numéricos.");
    }

    return {
      preco_diesel: data.preco_diesel,
      preco_gasolina: data.preco_gasolina,
      fonte: data.fonte || "Fonte Desconhecida",
    };
  } catch (error) {
    console.error("Erro ao buscar preços de combustível:", error);
    throw new Error(`Falha ao obter dados de preços: ${error.message}`);
  }
}