import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// NOVO: URL da API z.AI (Placeholder - Substitua pela URL real da sua API z.AI)
const ZAI_API_URL = "https://api.z.ai/v1/chat/completions"; 

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
    const ZAI_API_KEY = Deno.env.get("Chat IA P Trab Inteligente");
    if (!ZAI_API_KEY) {
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

    // 3. Preparar o payload para a API z.AI (Formato OpenAI/Chat padrão)
    const payload = {
      model: "gpt-3.5-turbo", // Modelo comum em APIs de terceiros
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message }
      ],
      temperature: 0.7,
      max_tokens: 2048,
    };

    // 4. Chamar a API z.AI
    const response = await fetch(ZAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZAI_API_KEY}`, // Usando Bearer Token
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("z.AI API Error:", errorText);
      throw new Error(`z.AI API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // 5. Extrair a resposta do formato Chat padrão (choices[0].message.content)
    const aiResponse = data.choices?.[0]?.message?.content || "Não foi possível obter uma resposta da IA.";

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