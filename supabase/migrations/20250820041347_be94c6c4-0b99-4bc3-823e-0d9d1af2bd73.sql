-- Corrigir o constraint de role para incluir 'gestor' e remover 'editor'/'viewer'
ALTER TABLE public.user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role = ANY (ARRAY['master'::text, 'owner'::text, 'gestor'::text, 'faxineira'::text]));

-- Atualizar o trigger handle_new_user para incluir as novas permissões granulares
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$DECLARE
  -- Declara uma variável para armazenar o role
  v_role TEXT;
BEGIN
  -- ETAPA 1: Define o role do novo usuário como 'gestor' por padrão
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'gestor');

  -- ETAPA 2: Insere o perfil principal na tabela user_profiles
  INSERT INTO public.user_profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    v_role
  );

  -- ETAPA 3: Se o role for 'faxineira', cria o perfil complementar com todos os dados.
  IF v_role = 'faxineira' THEN
    INSERT INTO public.cleaner_profiles (user_id, phone, address)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'phone',   -- Lê o telefone dos metadados
      NEW.raw_user_meta_data->>'address'  -- Lê o endereço dos metadados
    );
  END IF;

  -- ETAPA 4: Se o role for 'owner', insere o conjunto completo de permissões
  IF v_role = 'owner' THEN
    INSERT INTO public.user_permissions (user_id, permission_type, permission_value)
    VALUES
      -- Permissões de Propriedades
      (NEW.id, 'properties_create', true),
      (NEW.id, 'properties_edit', true),
      (NEW.id, 'properties_delete', true),
      (NEW.id, 'properties_view_assigned', true),
      
      -- Permissões de Reservas
      (NEW.id, 'reservations_create', true),
      (NEW.id, 'reservations_edit', true),
      (NEW.id, 'reservations_delete', true),
      (NEW.id, 'reservations_view_assigned', true),

      -- Permissões de Despesas
      (NEW.id, 'expenses_create', true),
      (NEW.id, 'expenses_edit', true),
      (NEW.id, 'expenses_view', true),

      -- Permissões de Investimentos
      (NEW.id, 'investments_create', true),
      (NEW.id, 'investments_view', true),

      -- Permissões do Dashboard
      (NEW.id, 'dashboard_revenue', true),
      (NEW.id, 'dashboard_occupancy', true),
      (NEW.id, 'dashboard_expenses', true),
      (NEW.id, 'dashboard_profit', true),

      -- Permissões de Relatórios
      (NEW.id, 'reports_create', true),
      (NEW.id, 'reports_view', true),
      
      -- Permissões de Sistema
      (NEW.id, 'users_manage', true),
      (NEW.id, 'system_settings', true),

      -- Permissões de Anfitrião Alerta (completas para owner)
      (NEW.id, 'anfitriao_alerta_view', true),
      (NEW.id, 'anfitriao_alerta_create', true),
      (NEW.id, 'anfitriao_alerta_edit', true),
      (NEW.id, 'anfitriao_alerta_delete', true),
      (NEW.id, 'anfitriao_alerta_manage', true),
      
      -- Permissões de Gestão de Faxinas (completas para owner)
      (NEW.id, 'gestao_faxinas_view', true),
      (NEW.id, 'gestao_faxinas_assign', true),
      (NEW.id, 'gestao_faxinas_reassign', true),
      (NEW.id, 'gestao_faxinas_manage', true);
  END IF;

  -- ETAPA 5: Se o role for 'gestor', insere permissões limitadas
  IF v_role = 'gestor' THEN
    INSERT INTO public.user_permissions (user_id, permission_type, permission_value)
    VALUES
      -- Permissões básicas de visualização
      (NEW.id, 'properties_view_assigned', true),
      (NEW.id, 'reservations_view_assigned', true),
      (NEW.id, 'expenses_view', true),
      (NEW.id, 'investments_view', true),
      
      -- Permissões do Dashboard (visualização)
      (NEW.id, 'dashboard_revenue', true),
      (NEW.id, 'dashboard_occupancy', true),
      (NEW.id, 'dashboard_expenses', true),
      (NEW.id, 'dashboard_profit', true),

      -- Permissões de Relatórios (visualização)
      (NEW.id, 'reports_view', true),
      
      -- Permissões de Anfitrião Alerta (visualização apenas)
      (NEW.id, 'anfitriao_alerta_view', true),
      
      -- Permissões de Gestão de Faxinas (visualização apenas)
      (NEW.id, 'gestao_faxinas_view', true);
  END IF;

  RETURN NEW;
END;$function$;