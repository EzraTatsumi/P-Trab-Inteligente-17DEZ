import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_URL = 'https://dadosabertos.compras.gov.br/modulo-material/4_consultarItemMaterial';
const PAGE_SIZE = '1'; // Só precisamos de um resultado

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
    
    // Remove caracteres não numéricos e garante 9 dígitos (padrão CATMAT)
    const cleanCode = String(codigoItem).replace(/\D/g, '').padStart(9, '0');

    const params = new URLSearchParams({
        pagina: PAGE_SIZE,
        tamanhoPagina: PAGE_SIZE,
        codigoItem: cleanCode,
        bps: 'false',
    });

    const fullUrl = `${API_URL}?${params.toString()}`;
    
    console.log(`[fetch-catmat-details] Fetching details for code ${cleanCode} from: ${fullUrl}`);

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
    
    const result = data.resultado?.[0];

    if (!result) {
        console.log(`[fetch-catmat-details] No result found for code ${cleanCode}`);
        return new Response(JSON.stringify({ error: 'Item not found in PNCP Material Catalog.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
        });
    }

    // Mapeia apenas os campos necessários
    const mappedResult = {
        codigoItem: String(result.codigoItem),
        descricaoItem: result.descricaoItem, // Descrição completa oficial
        nomePdm: result.nomePdm, // Nome reduzido sugerido (PDM)
    };

    console.log(`[fetch-catmat-details] Successfully fetched details for code ${cleanCode}`);

    return new Response(JSON.stringify(mappedResult), {
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