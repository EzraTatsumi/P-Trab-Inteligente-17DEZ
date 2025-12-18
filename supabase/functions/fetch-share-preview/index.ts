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

  // 1. Criar cliente Supabase com Service Role Key
  const supabaseServiceRole = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  try {
    const { ptrabId, token } = await req.json();

    if (!ptrabId || !token) {
      return new Response(JSON.stringify({ error: 'Missing ptrabId or token' }), { status: 400, headers: corsHeaders });
    }

    // 2. Buscar PTrab e o ID do proprietário (usando Service Role)
    const { data: ptrab, error: ptrabError } = await supabaseServiceRole
      .from('p_trab')
      .select('numero_ptrab, nome_operacao, user_id')
      .eq('id', ptrabId)
      .eq('share_token', token)
      .single();

    if (ptrabError || !ptrab) {
      return new Response(JSON.stringify({ error: 'P Trab not found or token invalid' }), { status: 404, headers: corsHeaders });
    }
    
    // 3. Buscar o perfil do proprietário (user_id)
    const { data: profile, error: profileError } = await supabaseServiceRole
      .from('profiles')
      .select('first_name, last_name, raw_user_meta_data')
      .eq('id', ptrab.user_id)
      .single();
      
    if (profileError || !profile) {
        console.warn(`Profile not found for user ID: ${ptrab.user_id}`);
    }
    
    // 4. Formatar o nome do proprietário
    const metadata = profile?.raw_user_meta_data as { posto_graduacao?: string } | undefined;
    const nomeGuerra = profile?.last_name || profile?.first_name || 'Proprietário Desconhecido';
    const postoGraduacao = metadata?.posto_graduacao || '';
    
    const ownerName = postoGraduacao ? `${postoGraduacao} ${nomeGuerra}` : nomeGuerra;

    return new Response(
      JSON.stringify({
        ptrabName: `${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`,
        ownerName: ownerName,
      }),
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