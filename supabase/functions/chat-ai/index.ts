import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Importa o cliente Supabase para interagir com o banco de dados (se necessário)
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// URL da API do OpenAI (ou outro LLM)
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Contexto do sistema para guiar a IA
const SYSTEM_PROMPT = `Você é Dyad, um assistente de IA amigável e prestativo, especializado em guiar usuários através do aplicativo PTrab Inteligente. Seu objetivo é responder a perguntas sobre a usabilidade, o fluxo de trabalho e as funcionalidades do aplicativo. Mantenha as respostas concisas, focadas na ajuda ao usuário e no contexto do aplicativo. Não responda a perguntas fora do escopo do PTrab Inteligente.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Autenticação (Opcional, mas recomendado para limitar o uso)
    // const authHeader = req.headers.get('Authorization');
    // if (!authHeader) {
    //   return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    // }

    // 2. Obter a chave de API do segredo
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not set in environment secrets.");
    }

    // 3. Obter a mensagem do usuário
    const { message } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: 'Missing message parameter' }), { status: 400, headers: corsHeaders });
    }

    // 4. Chamar a API do LLM
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // Modelo de sua escolha
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API Error:", errorText);
      throw new Error(`OpenAI API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ response: aiResponse }),
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