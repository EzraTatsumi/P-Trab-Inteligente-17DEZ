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
    const { codigoUnidadeGerenciadora, dataVigenciaInicialMin, dataVigenciaInicialMax } = await req.json();

    if (!codigoUnidadeGerenciadora || !dataVigenciaInicialMin || !dataVigenciaInicialMax) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: UASG and date range.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const API_URL = 'https://dadosabertos.compras.gov.br/modulo-arp/1_consultarARP';
    
    // Parâmetros fixos e dinâmicos
    const params = new URLSearchParams({
      pagina: '1',
      tamanhoPagina: '500',
      codigoUnidadeGerenciadora: codigoUnidadeGerenciadora,
      dataVigenciaInicialMin: dataVigenciaInicialMin,
      dataVigenciaInicialMax: dataVigenciaInicialMax,
    });

    const fullUrl = `${API_URL}?${params.toString()}`;
    
    console.log("[fetch-arps-by-uasg] Fetching ARPs from:", fullUrl);

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[fetch-arps-by-uasg] External API error:", response.status, errorText);
      throw new Error(`External API failed with status ${response.status}`);
    }

    const data = await response.json();
    
    console.log(`[fetch-arps-by-uasg] Successfully fetched ${data.length || 0} records.`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[fetch-arps-by-uasg] General error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});