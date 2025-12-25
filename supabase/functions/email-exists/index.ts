import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    /* =====================================================
       ✅ API ESTÁVEL (FUNCIONA EM TODOS OS RUNTIMES)
    ====================================================== */
    // Usando listUsers para contornar o problema de getUserByEmail e a falha da API REST
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000, // limite seguro
    });

    if (error) {
      console.error("listUsers error:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao consultar usuários" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filtragem manual no lado da Edge Function
    const exists = data.users.some(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    );

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