import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Endpoint da API do Catálogo de Material do PNCP
const API_URL = 'https://dadosabertos.compras.gov.br/catalogo-material/1_consultarItem_Codigo';
const PAGE_SIZE = '10'; // Tamanho mínimo de página exigido pela API (entre 10 e 500)

/**
 * Função auxiliar para buscar detalhes de um item CATMAT.
 */
async function fetchCatmatDetails(codigoItem: string) {
    const params = new URLSearchParams({
        pagina: '1',
        tamanhoPagina: PAGE_SIZE, // CORREÇÃO: Define o tamanho da página para 10
        codigoItem: codigoItem,
    });

    const fullUrl = `${API_URL}?${params.toString()}`;
    
    console.log(`[fetch-catmat-details] Fetching details for item ${codigoItem} from: ${fullUrl}`);

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
    
    // A API retorna um objeto com 'resultado' que é um array de itens
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
    
    // Remove caracteres não numéricos e preenche com zeros à esquerda (9 dígitos)
    const cleanCode = String(codigoItem).replace(/\D/g, '').padStart(9, '0');

    const results = await fetchCatmatDetails(cleanCode);
    
    if (results.length === 0) {
        return new Response(JSON.stringify({ 
            codigoItem: codigoItem,
            descricaoItem: "Item não encontrado no Catálogo de Material do PNCP.",
            nomePdm: null,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // Assume que o primeiro resultado é o mais relevante
    const item = results[0];
    
    // Mapeia os campos relevantes da resposta da API
    const mappedDetails = {
        codigoItem: item.codigoItem || cleanCode,
        descricaoItem: item.descricaoItem || 'Descrição não disponível',
        nomePdm: item.nomePdm || null, // Nome reduzido sugerido
    };

    console.log(`[fetch-catmat-details] Successfully fetched details for item ${cleanCode}.`);

    return new Response(JSON.stringify(mappedDetails), {
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