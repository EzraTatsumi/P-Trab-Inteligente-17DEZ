import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Endpoint da API REST de Autenticação para listar usuários por email
    const AUTH_API_URL = `${SUPABASE_URL}/auth/v1/admin/users?email=eq.${encodeURIComponent(email)}`;

    const authResponse = await fetch(AUTH_API_URL, {
        method: 'GET',
        headers: {
            // A Service Role Key é obrigatória para acessar endpoints de admin
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            // A apikey (anon key) também é necessária para a API REST
            'apikey': ANON_KEY, 
            'Content-Type': 'application/json',
        },
    });

    if (!authResponse.ok) {
        const errorText = await authResponse.text();
        console.error("Supabase Auth REST API Error:", authResponse.status, errorText);
        throw new Error(`Falha na API de Autenticação: Status ${authResponse.status}`);
    }

    const data = await authResponse.json();
    
    // A resposta é um array de usuários. Se o array tiver 1 ou mais elementos, o usuário existe.
    const exists = data.users && data.users.length > 0;
    
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