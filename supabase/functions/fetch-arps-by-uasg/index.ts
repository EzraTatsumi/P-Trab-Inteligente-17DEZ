import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_URL = 'https://dadosabertos.compras.gov.br/modulo-arp/1_consultarARP';
const PAGE_SIZE = '500'; // Tamanho máximo permitido

/**
 * Função auxiliar para buscar uma página específica de ARPs.
 */
async function fetchArpPage(
    codigoUnidadeGerenciadora: string, 
    dataVigenciaInicialMin: string, 
    dataVigenciaInicialMax: string, 
    pagina: number
) {
    const params = new URLSearchParams({
        pagina: String(pagina),
        tamanhoPagina: PAGE_SIZE,
        codigoUnidadeGerenciadora: codigoUnidadeGerenciadora,
        dataVigenciaInicialMin: dataVigenciaInicialMin,
        dataVigenciaInicialMax: dataVigenciaInicialMax,
    });

    const fullUrl = `${API_URL}?${params.toString()}`;
    
    console.log(`[fetch-arps-by-uasg] Fetching page ${pagina} from: ${fullUrl}`);

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
    
    // Retorna o objeto de resposta completo, incluindo metadados de paginação
    return data;
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

    let allResults: any[] = [];
    let currentPage = 1;
    let totalPages = 1; 

    do {
        const data = await fetchArpPage(
            codigoUnidadeGerenciadora, 
            dataVigenciaInicialMin, 
            dataVigenciaInicialMax, 
            currentPage
        );
        
        const resultsArray = data.resultado || [];
        const paginationMetadata = data.paginacao || {};
        
        // Acumula os resultados
        allResults = allResults.concat(resultsArray);
        
        // Atualiza o total de páginas (apenas na primeira iteração)
        if (currentPage === 1) {
            totalPages = paginationMetadata.totalPaginas || 1;
            console.log(`[fetch-arps-by-uasg] Total pages detected: ${totalPages}`);
        }
        
        currentPage++;
        
    } while (currentPage <= totalPages);

    console.log(`[fetch-arps-by-uasg] Successfully fetched ${allResults.length} total records across ${totalPages} pages.`);

    // Retorna o array consolidado de resultados
    return new Response(JSON.stringify(allResults), {
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