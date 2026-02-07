import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_URL = 'https://dadosabertos.compras.gov.br/modulo-material/4_consultarItemMaterial';
const PAGE_SIZE = '10'; // CORRIGIDO: Tamanho mínimo permitido pela API é 10

/**
 * Função auxiliar para buscar os detalhes do item CATMAT.
 */
async function fetchCatmatDetails(codigoItem: string) {
    const params = new URLSearchParams({
        pagina: '1', // Usamos a primeira página
        tamanhoPagina: PAGE_SIZE,
        codigoItem: codigoItem,
        bps: 'false',
    });

    const fullUrl = `${API_URL}?${params.toString()}`;
    
    console.log(`[fetch-catmat-details] Fetching details for CATMAT ${codigoItem}`);

    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[fetch-catmat-details] External API error:", response.status, errorText);
        throw new Error(`External API failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // Retorna o array de resultados
    return data.resultado || [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { codigoItem } = await req.json();

    if (!codigoItem) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: codigoItem.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Remove caracteres não numéricos
    const cleanCode = String(codigoItem).replace(/\D/g, '');

    const results = await fetchCatmatDetails(cleanCode);
    
    if (results.length === 0) {
        // Tenta buscar o código preenchido com zeros à esquerda (9 dígitos)
        const paddedCode = cleanCode.padStart(9, '0');
        if (paddedCode !== cleanCode) {
            const paddedResults = await fetchCatmatDetails(paddedCode);
            if (paddedResults.length > 0) {
                console.log(`[fetch-catmat-details] Found details using padded code ${paddedCode}`);
                return new Response(JSON.stringify(paddedResults[0]), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                });
            }
        }
        
        console.log(`[fetch-catmat-details] No details found for CATMAT ${codigoItem}`);
        return new Response(JSON.stringify({}), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    console.log(`[fetch-catmat-details] Successfully fetched details for CATMAT ${codigoItem}`);

    // Retorna o primeiro resultado detalhado
    return new Response(JSON.stringify(results[0]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[fetch-catmat-details] General error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});