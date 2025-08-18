
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AppRole = 'master' | 'owner' | 'editor' | 'viewer' | 'faxineira';

interface CreateUserRequest {
  email: string;
  password?: string; // opcional para fluxo de atualização
  fullName: string;
  role?: AppRole;
  phone?: string;
  address?: string;
  propertyIds?: string[]; // novos vínculos de propriedades para faxineira
  notes?: string; // observações da faxineira
}

const handler = async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const raw = await req.json();
    const {
      email: inputEmail,
      password,
      fullName,
      role: inputRole = 'viewer',
      phone,
      address,
      propertyIds = [],
      notes,
    } = raw as CreateUserRequest;

    const email = String(inputEmail || '').trim().toLowerCase();
    const role: AppRole = inputRole;

    if (!email || !fullName) {
      return new Response(
        JSON.stringify({ error: 'email e fullName são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Observação: para criar um novo usuário é necessário password
    // Para atualizar usuário existente, password é opcional.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    console.log('[create-user] Starting with email:', email, 'role:', role);

    // Primeiro verificamos se já existe um perfil com este email
    const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, role')
      .eq('email', email)
      .maybeSingle();

    if (profileLookupError) {
      console.error('[create-user] Error looking up profile by email:', profileLookupError);
      throw profileLookupError;
    }

    const ensureCleanerLinks = async (userId: string) => {
      // Garante cleaner_profiles com phone/address/notes
      const { error: upsertCleanerError } = await supabaseAdmin
        .from('cleaner_profiles')
        .upsert({
          user_id: userId,
          phone: phone ?? null,
          address: address ?? null,
          notes: notes ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (upsertCleanerError) {
        console.error('[create-user] Error upserting cleaner_profiles:', upsertCleanerError);
        throw upsertCleanerError;
      }

      // Se propertyIds vier preenchido, refaz os vínculos (remove e re-insere)
      if (Array.isArray(propertyIds) && propertyIds.length > 0) {
        const { error: deleteLinksError } = await supabaseAdmin
          .from('cleaner_properties')
          .delete()
          .eq('user_id', userId);

        if (deleteLinksError) {
          console.error('[create-user] Error deleting old cleaner_properties:', deleteLinksError);
          throw deleteLinksError;
        }

        const links = propertyIds.map((propId: string) => ({
          user_id: userId,
          property_id: propId,
        }));

        const { error: insertLinksError } = await supabaseAdmin
          .from('cleaner_properties')
          .insert(links);

        if (insertLinksError) {
          console.error('[create-user] Error inserting cleaner_properties:', insertLinksError);
          throw insertLinksError;
        }
      }
    };

    // Caminho: USUÁRIO EXISTENTE (idempotência)
    if (existingProfile?.user_id) {
      const userId = existingProfile.user_id;
      console.log('[create-user] Existing user found:', userId, 'Updating metadata/profile...');

      // Atualiza metadados no Auth (não altera senha por padrão)
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          full_name: fullName,
          role,
          phone,
          address,
        },
        // password: password // Descomentaria apenas se desejar forçar troca de senha em atualização
      });
      if (updateAuthError) {
        console.error('[create-user] Error updating auth user metadata:', updateAuthError);
        throw updateAuthError;
      }

      // Upsert no user_profiles com o role fornecido
      const { error: upsertProfileError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          user_id: userId,
          email,
          full_name: fullName,
          role,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (upsertProfileError) {
        console.error('[create-user] Error upserting user_profiles:', upsertProfileError);
        throw upsertProfileError;
      }

      // Se for faxineira, garantir cleaner_profiles e vínculos/notes
      if (role === 'faxineira') {
        await ensureCleanerLinks(userId);

        // Remove quaisquer permissões indevidas desse usuário (ex.: herdadas de owner)
        const { error: deletePermsError } = await supabaseAdmin
          .from('user_permissions')
          .delete()
          .eq('user_id', userId);
        if (deletePermsError) {
          console.error('[create-user] Error deleting user_permissions:', deletePermsError);
          throw deletePermsError;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'updated',
          user: { id: userId, email, full_name: fullName, role }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Caminho: NOVO USUÁRIO
    if (!password) {
      return new Response(
        JSON.stringify({ error: 'password é obrigatório para criar um novo usuário' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-user] Creating new auth user...');
    const { data: userData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        phone,
        address,
      }
    });

    if (createAuthError) {
      console.error('[create-user] Error creating user in auth:', createAuthError);
      throw createAuthError;
    }

    if (!userData.user) {
      throw new Error('Failed to create user');
    }

    const newUserId = userData.user.id;
    console.log('[create-user] Auth user created:', newUserId, 'Ensuring profiles...');

    // Garantir user_profiles
    const { data: existingProfileByUser, error: lookupByUserError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('user_id', newUserId)
      .maybeSingle();
    if (lookupByUserError) {
      console.error('[create-user] Error lookup user_profiles by user_id:', lookupByUserError);
      // Tentaremos seguir e upsert abaixo; se falhar, deletamos o auth user
    }

    let profileError: any = null;
    if (existingProfileByUser) {
      const { error: updateProfileError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          email,
          full_name: fullName,
          role,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', newUserId);
      if (updateProfileError) profileError = updateProfileError;
    } else {
      const { error: insertProfileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          user_id: newUserId,
          email,
          full_name: fullName,
          role,
          is_active: true,
        });
      if (insertProfileError) profileError = insertProfileError;
    }

    if (profileError) {
      console.error('[create-user] Error ensuring user profile:', profileError);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw profileError;
    }

    // Se for faxineira, garantir cleaner_profiles e vínculos/notes
    if (role === 'faxineira') {
      await ensureCleanerLinks(newUserId);

      // Garanta que não haja permissões indevidas
      const { error: deletePermsError } = await supabaseAdmin
        .from('user_permissions')
        .delete()
        .eq('user_id', newUserId);
      if (deletePermsError) {
        console.error('[create-user] Error deleting user_permissions (new user):', deletePermsError);
        // Não é crítico a ponto de excluir usuário, então só loga
      }
    }

    console.log('[create-user] User created and profiles ensured successfully');
    return new Response(
      JSON.stringify({
        success: true,
        action: 'created',
        user: { id: newUserId, email, full_name: fullName, role }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[create-user] Unhandled error:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || 'Internal server error',
        details: error,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
