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
    const body = await req.json();
    // Ensure email is extracted and trimmed safely
    const email = body.email ? String(body.email).trim() : null; 
    let userId: string | null = null;

    if (authHeader) {
      // --- Case 1: Deletion by JWT (Authenticated User) ---
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabaseServiceRole.auth.getUser(token);

      if (userError || !user) {
        console.error("JWT Validation Error:", userError);
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid user token.' }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      userId = user.id;
      console.log(`User ID found via JWT: ${userId}`);
      
    } else if (email) {
      // --- Case 2: Deletion by Email (Unauthenticated/Unconfirmed User) ---
      console.log(`Attempting to find user by email: ${email}`);
      
      // Use auth.admin.listUsers to find the user by email
      const { data: { users }, error: listError } = await supabaseServiceRole.auth.admin.listUsers({
          filter: `email eq '${email}'`,
          perPage: 1,
      });
      
      if (listError) {
          console.error("Admin list users error:", listError);
          // Return a specific error response for DB failure
          return new Response(JSON.stringify({ error: 'Database error while finding user by email.' }), { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
      }
      
      const userToDelete = users?.[0];
      
      if (!userToDelete) {
          console.log(`User not found for email: ${email}`);
          return new Response(JSON.stringify({ error: 'User not found for this email.' }), { 
              status: 404, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
      }
      
      // Security Check: Only allow deletion if the email is NOT confirmed
      if (userToDelete.email_confirmed_at) {
          console.log(`User ${userToDelete.id} is confirmed. Deletion denied.`);
          return new Response(JSON.stringify({ error: 'Unauthorized: Confirmed users must be logged in to delete their account.' }), { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
      }
      
      userId = userToDelete.id;
      console.log(`Unconfirmed User ID found via email: ${userId}`);
      
    } else {
      // Neither token nor email provided
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header or email parameter.' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 4. Excluir o usuário usando o Service Role Client
    if (!userId) {
        throw new Error("Internal logic error: userId is null after checks.");
    }
    
    console.log(`Attempting to delete user ID: ${userId}`);
    const { error: deleteError } = await supabaseServiceRole.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      throw new Error(deleteError.message);
    }
    
    console.log(`User ${userId} deleted successfully.`);

    return new Response(
      JSON.stringify({ message: `User ${userId} deleted successfully.` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error) {
    console.error("Edge Function Final Catch Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});