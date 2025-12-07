import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token de compartilhamento ausente." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Cria um cliente Supabase com a chave de serviço para ignorar RLS
    // Isso é necessário para buscar o P Trab APENAS pelo token, sem autenticação de usuário.
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: ptrab, error } = await supabaseServiceRole
      .from('p_trab')
      .select('id, numero_ptrab, nome_operacao, user_id, shared_with')
      .eq('share_token', token)
      .maybeSingle();

    if (error) throw error;

    if (!ptrab) {
      return new Response(JSON.stringify({ error: "P Trab não encontrado ou token inválido." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Retorna os dados básicos do P Trab
    return new Response(
      JSON.stringify(ptrab),
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