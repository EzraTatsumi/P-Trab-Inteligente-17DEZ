import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_URL = 'https://dadosabertos.compras.gov.br/modulo-pesquisa-preco/1_consultarMaterial';
const PAGE_SIZE = '500'; // Tamanho máximo permitido

/**
 * Função auxiliar para buscar uma página específica de dados de preço.
 */
async function fetchPricePage(
    codigoItemCatalogo: string, 
    dataCompraInicio: string | null, 
    dataCompraFim: string | null, 
    pagina: number
) {
    const params = new URLSearchParams({
        pagina: String(pagina),
        tamanhoPagina: PAGE_SIZE,
        codigoItemCatalogo: codigoItemCatalogo,
    });
    
    if (dataCompraInicio) {
        params.append('dataCompraInicio', dataCompraInicio);
    }
    if (dataCompraFim) {
        params.append('dataCompraFim', dataCompraFim);
    }

    const fullUrl = `${API_URL}?${params.toString()}`;
    
    console.log(`[fetch-price-stats] Fetching page ${pagina} for CATMAT ${codigoItemCatalogo}`);

    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[fetch-price-stats] External API error:", response.status, errorText);
        throw new Error(`External API failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // Retorna o objeto de resposta completo, incluindo metadados de paginação
    return data;
}

/**
 * Calcula a mediana de um array de números.
 */
function calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    // 1. Ordena o array
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        // Se for par, média dos dois valores centrais
        return (sorted[middle - 1] + sorted[middle]) / 2;
    } else {
        // Se for ímpar, valor central
        return sorted[middle];
    }
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
    
    const cleanCode = String(codigoItem).replace(/\D/g, '');

    let allPrices: number[] = [];
    let allRawRecords: { codigoUasg: string, nomeUasg: string, precoUnitario: number }[] = []; // Array para registros brutos
    let currentPage = 1;
    let totalPages = 1; 
    let itemDescription: string | null = null;

    do {
        const data = await fetchPricePage(
            cleanCode, 
            dataInicio, 
            dataFim, 
            currentPage
        );
        
        const resultsArray = data.resultado || [];
        const paginationMetadata = data.paginacao || {};
        
        // Coleta os preços unitários, a descrição do item E os registros brutos
        resultsArray.forEach((item: any) => {
            if (item.precoUnitario && typeof item.precoUnitario === 'number' && item.precoUnitario > 0) {
                allPrices.push(item.precoUnitario);
                
                // Coleta o registro bruto. Usamos o operador || 'N/A' para garantir que seja uma string.
                const codigoUasg = String(item.codigoUnidadeGestora || 'N/A');
                const nomeUasg = String(item.nomeUnidadeGestora || 'N/A');

                allRawRecords.push({
                    codigoUasg: codigoUasg,
                    nomeUasg: nomeUasg,
                    precoUnitario: item.precoUnitario,
                });
            }
            if (!itemDescription && item.descricaoItem) {
                itemDescription = item.descricaoItem;
            }
        });
        
        // Atualiza o total de páginas (apenas na primeira iteração)
        if (currentPage === 1) {
            totalPages = paginationMetadata.totalPaginas || 1;
            console.log(`[fetch-price-stats] Total pages detected: ${totalPages}`);
        }
        
        currentPage++;
        
    } while (currentPage <= totalPages);
    
    if (allPrices.length === 0) {
        return new Response(JSON.stringify({ 
            codigoItem: cleanCode,
            descricaoItem: itemDescription,
            stats: null,
            totalRegistros: 0,
            rawRecords: [],
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // Cálculo das estatísticas
    const totalRegistros = allPrices.length;
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const sumPrices = allPrices.reduce((sum, price) => sum + price, 0);
    const avgPrice = sumPrices / totalRegistros;
    const medianPrice = calculateMedian(allPrices);
    
    const stats = {
        minPrice: parseFloat(minPrice.toFixed(2)),
        maxPrice: parseFloat(maxPrice.toFixed(2)),
        avgPrice: parseFloat(avgPrice.toFixed(2)),
        medianPrice: parseFloat(medianPrice.toFixed(2)),
    };

    console.log(`[fetch-price-stats] Successfully calculated stats for ${totalRegistros} records.`);

    return new Response(JSON.stringify({
        codigoItem: cleanCode,
        descricaoItem: itemDescription,
        stats: stats,
        totalRegistros: totalRegistros,
        rawRecords: allRawRecords,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[fetch-price-stats] General error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});