import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_URL = 'https://dadosabertos.compras.gov.br/modulo-preco/3_consultarPrecoItem';
const PAGE_SIZE = '500'; // Tamanho máximo permitido pela API

/**
 * Função auxiliar para buscar uma página específica de registros de preço.
 */
async function fetchPriceDetailsPage(
    codigoItem: string, 
    dataInicio: string | null, 
    dataFim: string | null, 
    pagina: number
) {
    const params = new URLSearchParams({
        pagina: String(pagina),
        tamanhoPagina: PAGE_SIZE,
        codigoItem: codigoItem,
    });

    // Adiciona datas se fornecidas
    if (dataInicio) {
        params.append('dataReferenciaInicial', dataInicio);
    }
    if (dataFim) {
        params.append('dataReferenciaFinal', dataFim);
    }

    const fullUrl = `${API_URL}?${params.toString()}`;
    
    console.log(`[fetch-price-stats-details] Fetching page ${pagina} for CATMAT ${codigoItem}`);

    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[fetch-price-stats-details] External API error:", response.status, errorText);
        throw new Error(`External API failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // Retorna o objeto de resposta completo, incluindo metadados de paginação
    return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { codigoItem, dataInicio, dataFim } = await req.json();

    if (!codigoItem) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: codigoItem.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Remove caracteres não numéricos do código
    const cleanCode = String(codigoItem).replace(/\D/g, '');

    let allResults: any[] = [];
    let currentPage = 1;
    let totalPages = 1; 

    do {
        const data = await fetchPriceDetailsPage(
            cleanCode, 
            dataInicio, 
            dataFim, 
            currentPage
        );
        
        const resultsArray = data.resultado || [];
        const paginationMetadata = data.paginacao || {};
        
        // Acumula os resultados
        allResults = allResults.concat(resultsArray);
        
        // Atualiza o total de páginas (apenas na primeira iteração)
        if (currentPage === 1) {
            totalPages = paginationMetadata.totalPaginas || 1;
            console.log(`[fetch-price-stats-details] Total pages detected: ${totalPages}`);
        }
        
        currentPage++;
        
    } while (currentPage <= totalPages);

    console.log(`[fetch-price-stats-details] Successfully fetched ${allResults.length} total records across ${totalPages} pages.`);

    // Retorna o array consolidado de resultados
    return new Response(JSON.stringify(allResults), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[fetch-price-stats-details] General error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});