import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// URL da API do Gemini (Google AI)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

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
    // 1. Obter a chave de API do segredo (Usando o nome do segredo fornecido no contexto)
    const GEMINI_API_KEY = Deno.env.get("Chat IA P Trab Inteligente");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Erro de Configuração: A chave 'Chat IA P Trab Inteligente' não está definida nos segredos da Edge Function." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Obter a mensagem do usuário
    const { message } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: 'Missing message parameter' }), { status: 400, headers: corsHeaders });
    }

    // 3. Preparar o payload para o Gemini API
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: `${SYSTEM_PROMPT}\n\nUsuário: ${message}` }
          ]
        }
      ],
      config: {
        temperature: 0.7,
        maxOutputTokens: 500,
      }
    };

    // 4. Chamar a API do Gemini
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // 5. Extrair a resposta do formato Gemini
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível obter uma resposta da IA.";

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