import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_URL = 'https://dadosabertos.compras.gov.br/modulo-arp/2_consultarARPItem';
const PAGE_SIZE = '500'; // Tamanho máximo permitido

/**
 * Função auxiliar para buscar uma página específica de itens de ARP por CATMAT.
 */
async function fetchArpItemPage(
    codigoItem: string, 
    dataVigenciaInicialMin: string, 
    dataVigenciaInicialMax: string, 
    pagina: number
) {
    const params = new URLSearchParams({
        pagina: String(pagina),
        tamanhoPagina: PAGE_SIZE,
        codigoItem: codigoItem,
        dataVigenciaInicialMin: dataVigenciaInicialMin,
        dataVigenciaInicialMax: dataVigenciaInicialMax,
    });

    const fullUrl = `${API_URL}?${params.toString()}`;
    
    console.log(`[fetch-arp-items-by-catmat] Fetching page ${pagina} for CATMAT ${codigoItem}`);

    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[fetch-arp-items-by-catmat] External API error:", response.status, errorText);
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
    const { codigoItem, dataVigenciaInicialMin, dataVigenciaInicialMax } = await req.json();

    if (!codigoItem || !dataVigenciaInicialMin || !dataVigenciaInicialMax) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: codigoItem and date range.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let allResults: any[] = [];
    let currentPage = 1;
    let totalPages = 1; 
    
    const cleanCode = String(codigoItem).replace(/\D/g, '');

    do {
        const data = await fetchArpItemPage(
            cleanCode, 
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
            console.log(`[fetch-arp-items-by-catmat] Total pages detected: ${totalPages}`);
        }
        
        currentPage++;
        
    } while (currentPage <= totalPages);

    console.log(`[fetch-arp-items-by-catmat] Successfully fetched ${allResults.length} total records across ${totalPages} pages.`);

    // Retorna o array consolidado de resultados
    return new Response(JSON.stringify(allResults), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[fetch-arp-items-by-catmat] General error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});