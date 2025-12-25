import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { email } = await req.json();
    console.log(`Received email for check: ${email}`);

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email não informado" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente Supabase com Service Role Key para acesso administrativo
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // ✅ Usando a função administrativa correta para verificar a existência do usuário
    const { data, error } = await supabaseAdmin.auth.admin.getUserByEmail(email);

    // Se o erro for 'User not found', isso significa que o usuário não existe, o que é o resultado esperado.
    if (error && error.message !== "User not found") {
      console.error("Supabase Admin Error:", error);
      throw new Error("Erro ao consultar o banco de dados de usuários.");
    }
    
    // O usuário existe se 'data' e 'data.user' estiverem presentes.
    const exists = !!data?.user;
    console.log(`User existence check result for ${email}: ${exists}`);

    return new Response(
      JSON.stringify({ exists }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error("email-exists error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});