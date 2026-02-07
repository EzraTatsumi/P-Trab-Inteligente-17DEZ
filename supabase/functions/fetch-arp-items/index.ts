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
    const { idCompra } = await req.json();

    if (!idCompra) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: idCompra.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const API_URL = 'https://dadosabertos.compras.gov.br/modulo-arp/2_consultarItemARP';
    
    // Parâmetros fixos e dinâmicos
    const params = new URLSearchParams({
      pagina: '1',
      tamanhoPagina: '500',
      idCompra: idCompra,
    });

    const fullUrl = `${API_URL}?${params.toString()}`;
    
    console.log("[fetch-arp-items] Fetching ARP items from:", fullUrl);

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[fetch-arp-items] External API error:", response.status, errorText);
      throw new Error(`External API failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // Extrair o array de resultados da chave 'resultado'
    const resultsArray = data.resultado || [];
    
    console.log(`[fetch-arp-items] Successfully fetched ${resultsArray.length} detailed items for idCompra ${idCompra}.`);

    // Retorna apenas o array de resultados
    return new Response(JSON.stringify(resultsArray), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[fetch-arp-items] General error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});