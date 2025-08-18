import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  role?: 'master' | 'owner' | 'editor' | 'viewer' | 'faxineira';
  phone?: string;
  address?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar se é uma requisição POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password, fullName, role = 'viewer', phone, address }: CreateUserRequest = await req.json();

    if (!email || !password || !fullName) {
      return new Response(
        JSON.stringify({ error: 'email, password and fullName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Creating user:', email);

    // 1. Criar usuário no auth.users usando Admin API
    const { data: userData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        full_name: fullName,
        role,
        phone,
        address,
      }
    });
    
    if (createAuthError) {
      console.error('Error creating user in auth:', createAuthError);
      throw createAuthError;
    }

    if (!userData.user) {
      throw new Error('Failed to create user');
    }

    console.log('User created in auth:', userData.user.id);

    // 2. Garantir perfil em user_profiles (atualiza se existir, senão cria)
    let profileError: any = null;

    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, role')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (existingProfile) {
      const { error: updateProfileError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          email,
          full_name: fullName,
          role,
          is_active: true,
        })
        .eq('user_id', userData.user.id);
      if (updateProfileError) profileError = updateProfileError;
    } else {
      const { error: insertProfileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          user_id: userData.user.id,
          email,
          full_name: fullName,
          role,
          is_active: true,
        });
      if (insertProfileError) profileError = insertProfileError;
    }

    if (profileError) {
      console.error('Error ensuring user profile:', profileError);
      // Se falhar, tentar deletar o usuário criado no auth
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
      throw profileError;
    }

    // 3. Se for faxineira, garantir cleaner_profiles com phone/address
    if (role === 'faxineira') {
      let cleanerError: any = null;
      const { data: existingCleaner } = await supabaseAdmin
        .from('cleaner_profiles')
        .select('id')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (existingCleaner) {
        const { error: updateCleanerError } = await supabaseAdmin
          .from('cleaner_profiles')
          .update({
            phone: phone ?? null,
            address: address ?? null,
          })
          .eq('user_id', userData.user.id);
        if (updateCleanerError) cleanerError = updateCleanerError;
      } else {
        const { error: insertCleanerError } = await supabaseAdmin
          .from('cleaner_profiles')
          .insert({
            user_id: userData.user.id,
            phone: phone ?? null,
            address: address ?? null,
          });
        if (insertCleanerError) cleanerError = insertCleanerError;
      }

      if (cleanerError) {
        console.error('Error ensuring cleaner profile:', cleanerError);
        await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
        throw cleanerError;
      }
    }

    console.log('User profile (and cleaner profile if applicable) ensured successfully');

    console.log('User profile created successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User created successfully',
        user: {
          id: userData.user.id,
          email: userData.user.email,
          full_name: fullName,
          role: role
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in create-user function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);