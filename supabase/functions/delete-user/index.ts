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
    const authHeader = req.headers.get('Authorization');
    let body: { email?: string };

    try {
      body = await req.json();
    } catch (e) {
      console.error("[delete-user] Error parsing request body:", e);
      return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Ensure email is extracted and trimmed safely
    const email = body.email ? String(body.email).trim() : null; 
    let userId: string | null = null;

    // Adiciona verificação robusta para o cabeçalho de autorização
    if (authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 10) {
      // --- Case 1: Deletion by JWT (Authenticated User) ---
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabaseServiceRole.auth.getUser(token);

      if (userError || !user) {
        console.error("[delete-user] JWT Validation Error:", userError);
        // Se o token for inválido, não retornamos 401 imediatamente, 
        // mas tentamos o Caminho 2 se o email estiver presente.
        // Se o email não estiver presente, retornamos 401.
        if (!email) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid user token and missing email.' }), { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
        }
        // Se o token for inválido, mas o email estiver presente, o fluxo continua para o Caminho 2.
      } else {
        userId = user.id;
        console.log(`[delete-user] User ID found via JWT: ${userId}`);
      }
    } 
    
    // Se o userId não foi encontrado via JWT (ou o JWT era inválido/ausente) E o email está presente, tenta o Caminho 2.
    if (!userId && email) {
      // --- Case 2: Deletion by Email (Unauthenticated/Unconfirmed User) ---
      console.log(`[delete-user] Attempting to find user by email: ${email}`);
      
      // Use auth.admin.listUsers to find the user by email
      const { data: { users }, error: listError } = await supabaseServiceRole.auth.admin.listUsers({
          filter: `email eq '${email}'`,
          perPage: 1,
      });
      
      if (listError) {
          console.error("[delete-user] Admin list users error:", listError);
          return new Response(JSON.stringify({ error: 'Database error while finding user by email.' }), { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
      }
      
      const userToDelete = users?.[0];
      
      if (!userToDelete) {
          console.log(`[delete-user] User not found for email: ${email}`);
          return new Response(JSON.stringify({ error: 'User not found for this email.' }), { 
              status: 404, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
      }
      
      // Security Check: Only allow deletion if the email is NOT confirmed
      if (userToDelete.email_confirmed_at) {
          console.log(`[delete-user] User ${userToDelete.id} is confirmed. Deletion denied.`);
          return new Response(JSON.stringify({ error: 'Unauthorized: Confirmed users must be logged in to delete their account.' }), { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
      }
      
      userId = userToDelete.id;
      console.log(`[delete-user] Unconfirmed User ID found via email: ${userId}`);
      
    } else if (!userId) {
      // Neither token nor email provided
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header or email parameter.' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 4. Excluir o usuário usando o Service Role Client
    if (!userId) {
        // Este caso só deve ocorrer se a lógica acima falhar, mas é um bom fallback
        throw new Error("Internal logic error: userId is null after checks.");
    }
    
    console.log(`[delete-user] Attempting to delete user ID: ${userId}`);
    const { error: deleteError } = await supabaseServiceRole.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("[delete-user] Error deleting user:", deleteError);
      throw new Error(deleteError.message);
    }
    
    console.log(`[delete-user] User ${userId} deleted successfully.`);

    return new Response(
      JSON.stringify({ message: `User ${userId} deleted successfully.` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error) {
    console.error("[delete-user] Edge Function Final Catch Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});