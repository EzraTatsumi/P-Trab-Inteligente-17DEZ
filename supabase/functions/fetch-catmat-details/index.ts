import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE_API_URL = 'https://dadosabertos.compras.gov.br/catalogo-material/v1/itens';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { codigoItem } = await req.json();

    if (!codigoItem) {
      console.error("[fetch-catmat-details] Missing codigoItem parameter.");
      return new Response(JSON.stringify({ error: 'Missing required parameter: codigoItem.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Limpa e preenche o código para 9 dígitos (padrão PNCP)
    const cleanCode = String(codigoItem).replace(/\D/g, '').padStart(9, '0');
    
    const fullUrl = `${BASE_API_URL}/${cleanCode}`;
    
    console.log(`[fetch-catmat-details] Fetching details for CATMAT: ${cleanCode}`);

    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[fetch-catmat-details] External API failed:", response.status, errorText);
        
        // Retorna um objeto de fallback em caso de falha na API externa
        return new Response(JSON.stringify({ 
            codigoItem: cleanCode,
            descricaoItem: `Falha ao carregar descrição oficial. Status: ${response.status}`,
            nomePdm: null,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, 
        });
    }

    const data = await response.json();
    
    // A API PNCP retorna um array de resultados sob 'resultado'
    const itemDetails = data.resultado?.[0]; 
    
    if (!itemDetails) {
        console.warn(`[fetch-catmat-details] Item ${cleanCode} found no details in 'resultado'.`);
        return new Response(JSON.stringify({ 
            codigoItem: cleanCode,
            descricaoItem: `Descrição oficial para ${cleanCode} não encontrada no PNCP.`,
            nomePdm: null,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
    
    // Mapeamento dos campos relevantes
    const mappedResult = {
        codigoItem: String(itemDetails.codigoItem || cleanCode),
        descricaoItem: itemDetails.descricaoItem || `Descrição oficial para ${cleanCode} não disponível.`,
        // O nome PDM é frequentemente o nome do item sem a descrição detalhada.
        nomePdm: itemDetails.nomeItem || null, 
    };

    console.log(`[fetch-catmat-details] Successfully fetched details for ${cleanCode}.`);

    return new Response(JSON.stringify(mappedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[fetch-catmat-details] General error:", error);
    return new Response(JSON.stringify({ 
        codigoItem: '',
        descricaoItem: 'Falha ao carregar descrição oficial.',
        nomePdm: null,
        error: error.message || 'Internal server error' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});