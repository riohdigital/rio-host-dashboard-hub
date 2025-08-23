-- Criar função para buscar faxineiras com validação de permissões
CREATE OR REPLACE FUNCTION public.fn_get_property_cleaners_for_user(
  p_property_id UUID
) 
RETURNS TABLE(
  id UUID,
  user_id UUID, 
  full_name TEXT,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_role_val TEXT;
  has_property_access BOOLEAN;
  can_manage_cleaners BOOLEAN;
BEGIN
  -- Obter role do usuário
  SELECT role INTO user_role_val 
  FROM public.user_profiles 
  WHERE user_id = auth.uid();

  -- Se for master, pode ver todas as faxineiras da propriedade
  IF user_role_val = 'master' THEN
    has_property_access := true;
    can_manage_cleaners := true;
  ELSE
    -- Verificar se tem acesso à propriedade
    SELECT EXISTS (
      SELECT 1 FROM user_property_access 
      WHERE user_id = auth.uid() 
      AND property_id = p_property_id
    ) INTO has_property_access;

    -- Verificar se tem permissão para gerenciar reservas ou faxinas
    SELECT EXISTS (
      SELECT 1 FROM user_permissions 
      WHERE user_id = auth.uid() 
      AND permission_type IN (
        'reservations_create', 
        'reservations_edit',
        'gestao_faxinas_assign',
        'gestao_faxinas_reassign',
        'gestao_faxinas_manage'
      )
      AND permission_value = true
    ) INTO can_manage_cleaners;
  END IF;

  -- Se não tem acesso à propriedade ou permissões, retornar vazio
  IF NOT has_property_access OR NOT can_manage_cleaners THEN
    RETURN;
  END IF;

  -- Retornar todas as faxineiras vinculadas à propriedade
  RETURN QUERY
  SELECT DISTINCT
    up.id,
    up.user_id,
    up.full_name,
    up.email,
    cp.phone,
    up.is_active
  FROM user_profiles up
  INNER JOIN cleaner_profiles cp ON up.user_id = cp.user_id
  INNER JOIN cleaner_properties cpr ON up.user_id = cpr.user_id
  WHERE cpr.property_id = p_property_id
    AND up.role = 'faxineira'
    AND up.is_active = true;
END;
$$;

-- Criar função para alternar status de faxina
CREATE OR REPLACE FUNCTION public.fn_toggle_cleaning_status(
  p_reservation_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_status TEXT;
  new_status TEXT;
  can_manage BOOLEAN;
  user_role_val TEXT;
BEGIN
  -- Verificar role do usuário
  SELECT role INTO user_role_val 
  FROM public.user_profiles 
  WHERE user_id = auth.uid();

  -- Verificar permissões
  IF user_role_val = 'master' THEN
    can_manage := true;
  ELSE
    -- Verificar se tem permissão gestao_faxinas_manage
    SELECT EXISTS (
      SELECT 1 FROM user_permissions 
      WHERE user_id = auth.uid() 
      AND permission_type = 'gestao_faxinas_manage'
      AND permission_value = true
    ) INTO can_manage;
  END IF;

  IF NOT can_manage THEN
    RAISE EXCEPTION 'Sem permissão para alterar status de faxina';
  END IF;

  -- Obter status atual
  SELECT cleaning_status INTO current_status
  FROM reservations
  WHERE id = p_reservation_id;

  -- Alternar status
  IF current_status = 'Pendente' THEN
    new_status := 'Realizada';
  ELSE
    new_status := 'Pendente';
  END IF;

  -- Atualizar status
  UPDATE reservations
  SET cleaning_status = new_status
  WHERE id = p_reservation_id;

  RETURN 'Status alterado para ' || new_status;
END;
$$;

-- Atualizar trigger handle_new_user para incluir permissões de gestão de faxinas para owners
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  -- Declara uma variável para armazenar o role
  v_role TEXT;
BEGIN
  -- ETAPA 1: Define o role do novo usuário como 'owner' por padrão
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'owner');

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
END;
$$;

-- Recriar o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();