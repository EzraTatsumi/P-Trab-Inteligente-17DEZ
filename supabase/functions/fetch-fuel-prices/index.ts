import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
const API_URL = "https://combustivelapi.com.br/api/precos/";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`Falha na API externa. Status: ${response.status}`);

    const data = await response.json();
    if (data.error) throw new Error(`A API retornou um erro: ${data.message}`);

    // Função para converter "6,3" do formato BR para o float 6.30
    const parsePrice = (priceStr: string | undefined) => {
      if (!priceStr) return 0;
      return parseFloat(priceStr.replace(',', '.'));
    };

    const dieselPrice = parsePrice(data.precos?.diesel?.br);
    const gasolinaPrice = parsePrice(data.precos?.gasolina?.br);

    if (dieselPrice === 0 || gasolinaPrice === 0) {
      throw new Error("Não foi possível extrair preços válidos.");
    }

    const result = {
      diesel: { price: dieselPrice, source: "Petrobras / Agregador BR" },
      gasolina: { price: gasolinaPrice, source: "Petrobras / Agregador BR" },
    };

    return new Response(JSON.stringify(result), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });
  } catch (error) {
    console.error("Erro na Edge Function fetch-fuel-prices:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
});