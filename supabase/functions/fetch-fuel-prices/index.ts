import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const DIESEL_API_URL = "https://api-preco-combustivel.onrender.com/diesel";
const GASOLINA_API_URL = "https://api-preco-combustivel.onrender.com/gasolina";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const [dieselResponse, gasolinaResponse] = await Promise.all([
      fetch(DIESEL_API_URL),
      fetch(GASOLINA_API_URL),
    ]);

    if (!dieselResponse.ok || !gasolinaResponse.ok) {
      const dieselStatus = dieselResponse.status;
      const gasolinaStatus = gasolinaResponse.status;
      throw new Error(`External API failure. Diesel Status: ${dieselStatus}, Gasolina Status: ${gasolinaStatus}`);
    }

    const dieselData = await dieselResponse.json();
    const gasolinaData = await gasolinaResponse.json();

    // Assuming the external API returns { preco: number }
    const result = {
      diesel: { price: dieselData.preco, source: "ANP (API Externa)" },
      gasolina: { price: gasolinaData.preco, source: "ANP (API Externa)" },
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});