import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// CORREÇÃO: Usando a API 4_consultarItemMaterial que se mostrou funcional
const API_URL = 'https://dadosabertos.compras.gov.br/modulo-material/4_consultarItemMaterial';

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
        // Adicionando parâmetros de paginação necessários para esta API
        pagina: '1',
        tamanhoPagina: '1',
        bps: 'false',
    });

    const fullUrl = `${API_URL}?${params.toString()}`;
    
    console.log(`[fetch-catmat-details] Fetching details for item: ${codigoItem} using API 4.`);

    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        // Se a API externa retornar 404, tratamos como 'Item não encontrado' e retornamos 200.
        if (response.status === 404) {
            console.warn(`[fetch-catmat-details] Item ${codigoItem} returned 404 from external API (Not Found).`);
            return new Response(JSON.stringify({
                codigoItem: codigoItem,
                descricaoItem: "Item não encontrado no Catálogo de Material do PNCP.",
                nomePdm: null,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }
        
        // Para outros erros (5xx, 4xx diferentes de 404), lançamos o erro
        const errorText = await response.text();
        console.error("[fetch-catmat-details] External API error:", response.status, errorText);
        throw new Error(`External API failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // A API 4_consultarItemMaterial retorna um array de resultados
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
        // O campo nomePdm é o que precisamos para a sugestão de descrição reduzida
        nomePdm: itemData.nomePdm || null, 
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[fetch-catmat-details] General error:", error);
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