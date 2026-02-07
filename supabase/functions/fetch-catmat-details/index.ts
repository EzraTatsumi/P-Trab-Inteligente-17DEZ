import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_URL = 'https://dadosabertos.compras.gov.br/modulo-catalogo/1_consultarItem_Id';

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

    const params = new URLSearchParams({
        codigoItem: codigoItem,
    });

    const fullUrl = `${API_URL}?${params.toString()}`;
    
    console.log(`[fetch-catmat-details] Fetching details for item: ${codigoItem}`);

    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[fetch-catmat-details] External API error:", response.status, errorText);
        // Lança um erro que será capturado pelo catch e retornado ao cliente
        throw new Error(`External API failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // A API do catálogo retorna um array de resultados
    const itemData = data.resultado?.[0];

    if (!itemData) {
        console.warn(`[fetch-catmat-details] Item ${codigoItem} not found in PNCP catalog.`);
        return new Response(JSON.stringify({
            codigoItem: codigoItem,
            descricaoItem: "Item não encontrado no Catálogo de Material do PNCP.",
            nomePdm: null,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // Mapeamento da resposta para o formato CatmatDetails
    const result = {
        codigoItem: String(itemData.codigoItem || codigoItem),
        descricaoItem: itemData.descricaoItem || 'Descrição oficial não disponível',
        nomePdm: itemData.nomePdm || null,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[fetch-catmat-details] General error:", error);
    // Retorna um objeto de erro específico que será verificado no frontend
    return new Response(JSON.stringify({
        codigoItem: null,
        descricaoItem: "Falha ao carregar descrição oficial.",
        nomePdm: null,
        error: error.message || 'Internal server error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});