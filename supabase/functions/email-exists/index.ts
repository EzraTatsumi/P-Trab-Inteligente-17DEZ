import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Usando a importação padrão do esm.sh para garantir que todos os módulos sejam carregados
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
    const body = await req.json().catch(() => null);
    const email = body?.email;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email não informado" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente Supabase com Service Role Key para acesso administrativo
    // O cliente criado com a Service Role Key automaticamente tem acesso a auth.admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      // Removendo as opções de auth, pois elas são irrelevantes para o Service Role
    );

    // ✅ ÚNICA FORMA CORRETA DE CHECAR EMAIL
    const { data, error } = await supabaseAdmin.auth.admin.getUserByEmail(email);

    // Se houver um erro E não for o erro esperado de 'User not found'
    if (error && error.message !== "User not found") {
      console.error("Supabase Admin Error:", error);
      // Retorna a mensagem de erro real do Supabase Admin para depuração
      throw new Error(`Supabase Admin Error: ${error.message}`); 
    }
    
    const exists = !!data?.user;
    console.log(`User existence check result for ${email}: ${exists}`);

    return new Response(
      JSON.stringify({ exists }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error("email-exists fatal error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno na função" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});