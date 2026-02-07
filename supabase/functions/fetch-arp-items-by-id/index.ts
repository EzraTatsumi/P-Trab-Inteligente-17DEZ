import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { numeroControlePncpAta } = await req.json();

    if (!numeroControlePncpAta) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: numeroControlePncpAta.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const API_URL = 'https://dadosabertos.compras.gov.br/modulo-arp/2.1_consultarARPItem_Id';
    
    // Parâmetros fixos e dinâmicos
    const params = new URLSearchParams({
      numeroControlePncpAta: numeroControlePncpAta,
    });

    const fullUrl = `${API_URL}?${params.toString()}`;
    
    console.log("[fetch-arp-items-by-id] Fetching ARP items from:", fullUrl);

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[fetch-arp-items-by-id] External API error:", response.status, errorText);
      throw new Error(`External API failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // Extrair o array de resultados da chave 'resultado'
    const resultsArray = data.resultado || [];
    
    console.log(`[fetch-arp-items-by-id] Successfully fetched ${resultsArray.length} detailed items.`);

    // Retorna apenas o array de resultados
    return new Response(JSON.stringify(resultsArray), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[fetch-arp-items-by-id] General error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});