import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import * as cheerio from 'https://esm.sh/cheerio@1.0.0-rc.12';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// URLs dos sites da Petrobras
const DIESEL_URL = "https://precos.petrobras.com.br/sele%C3%A7%C3%A3o-de-estados-diesel";
const GASOLINA_URL = "https://precos.petrobras.com.br/sele%C3%A7%C3%A3o-de-estados-gasolina";

/**
 * Função auxiliar para buscar e extrair o preço médio nacional de uma URL.
 * @param url A URL do produto (Diesel ou Gasolina).
 * @returns O preço como número.
 */
async function fetchAndExtractPrice(url: string): Promise<number> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // O preço médio nacional geralmente está em um elemento específico.
  // Baseado em inspeções comuns de sites da Petrobras, procuramos por classes ou IDs que contenham o valor.
  // Seletor comum para o preço médio nacional (pode precisar de ajuste se a estrutura mudar)
  const priceText = $('.preco-medio-nacional .valor').text().trim();
  
  if (!priceText) {
    // Tenta um seletor alternativo se o primeiro falhar
    const alternativePriceText = $('h2:contains("Preço médio nacional") + p').text().trim();
    if (alternativePriceText) {
        // Remove R$ e substitui vírgula por ponto
        const cleanedPrice = alternativePriceText.replace('R$', '').replace(',', '.').trim();
        return parseFloat(cleanedPrice);
    }
    
    // Seletor de fallback para o valor dentro de um card ou div de destaque
    const fallbackPriceText = $('.card-body h3').first().text().trim();
    if (fallbackPriceText) {
        const cleanedPrice = fallbackPriceText.replace('R$', '').replace(',', '.').trim();
        return parseFloat(cleanedPrice);
    }
    
    throw new Error("Price element not found or selector needs update.");
  }
  
  // Remove R$ e substitui vírgula por ponto
  const cleanedPrice = priceText.replace('R$', '').replace(',', '.').trim();
  return parseFloat(cleanedPrice);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // A Edge Function não precisa de autenticação para este caso de uso (preços públicos)
  
  try {
    const precoDiesel = await fetchAndExtractPrice(DIESEL_URL);
    const precoGasolina = await fetchAndExtractPrice(GASOLINA_URL);
    
    const result = {
      preco_diesel: precoDiesel,
      preco_gasolina: precoGasolina,
      fonte: "Petrobras - Preço Médio Nacional (Web Scraping)",
      data_consulta: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("Web Scraping Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Failed to perform web scraping" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});