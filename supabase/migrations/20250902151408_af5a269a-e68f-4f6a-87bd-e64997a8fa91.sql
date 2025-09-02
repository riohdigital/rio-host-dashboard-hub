-- Create unified function for assigning cleanings with proper permissions
CREATE OR REPLACE FUNCTION public.assign_cleaning_with_permissions(reservation_id uuid, cleaner_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  active_cleanings_count INT;
  is_urgent BOOLEAN;
  user_role_val TEXT;
  can_assign BOOLEAN;
BEGIN
  -- Get user role
  SELECT role INTO user_role_val 
  FROM public.user_profiles 
  WHERE user_id = auth.uid();

  -- Check permissions: master OR has gestao_faxinas_assign permission
  IF user_role_val = 'master' THEN
    can_assign := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM user_permissions perm
      WHERE perm.user_id = auth.uid() 
      AND perm.permission_type IN ('gestao_faxinas_assign', 'gestao_faxinas_manage')
      AND perm.permission_value = true
    ) INTO can_assign;
  END IF;

  IF NOT can_assign THEN
    RAISE EXCEPTION 'Acesso negado: sem permissão para atribuir faxinas';
  END IF;

  -- Verifica se a faxineira já tem uma faxina ativa
  SELECT count(*)
  INTO active_cleanings_count
  FROM public.reservations
  WHERE reservations.cleaner_user_id = cleaner_id AND reservations.cleaning_status = 'Pendente';

  -- Verifica se a reserva alvo é urgente (exceção à regra)
  SELECT ( (r.check_out_date || ' ' || r.checkout_time)::timestamp - now() ) <= interval '24 hours'
  INTO is_urgent
  FROM public.reservations r
  WHERE r.id = reservation_id;
  
  -- Aplica a regra de negócio
  IF active_cleanings_count > 0 AND NOT is_urgent THEN
    RAISE EXCEPTION 'REGRA_VIOLADA: Usuário já possui uma faxina ativa.';
  ELSE
    -- Atualiza a reserva
    UPDATE public.reservations
    SET cleaner_user_id = cleaner_id
    WHERE id = reservation_id AND cleaner_user_id IS NULL;
    
    IF FOUND THEN
      RETURN 'SUCESSO: Faxina atribuída com sucesso.';
    ELSE
      RAISE EXCEPTION 'FALHA_UPDATE: A faxina pode já ter sido atribuída por outra pessoa.';
    END IF;
  END IF;
END;
$$;

-- Create unified function for reassigning cleanings with proper permissions
CREATE OR REPLACE FUNCTION public.reassign_cleaning_with_permissions(reservation_id uuid, new_cleaner_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role_val TEXT;
  can_reassign BOOLEAN;
BEGIN
  -- Get user role
  SELECT role INTO user_role_val 
  FROM public.user_profiles 
  WHERE user_id = auth.uid();

  -- Check permissions: master OR has gestao_faxinas_reassign permission
  IF user_role_val = 'master' THEN
    can_reassign := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM user_permissions perm
      WHERE perm.user_id = auth.uid() 
      AND perm.permission_type IN ('gestao_faxinas_reassign', 'gestao_faxinas_manage')
      AND perm.permission_value = true
    ) INTO can_reassign;
  END IF;

  IF NOT can_reassign THEN
    RAISE EXCEPTION 'Acesso negado: sem permissão para reassignar faxinas';
  END IF;

  -- Verifica se o novo faxineiro existe e é ativo
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = new_cleaner_id AND role = 'faxineira' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Faxineira não encontrada ou inativa';
  END IF;

  -- Atualiza a reserva
  UPDATE public.reservations
  SET cleaner_user_id = new_cleaner_id,
      cleaning_status = 'Pendente'
  WHERE id = reservation_id;
  
  IF FOUND THEN
    RETURN 'SUCESSO: Faxina reassignada com sucesso.';
  ELSE
    RAISE EXCEPTION 'FALHA_UPDATE: Reserva não encontrada.';
  END IF;
END;
$$;

-- Create unified function for unassigning cleanings with proper permissions
CREATE OR REPLACE FUNCTION public.unassign_cleaning_with_permissions(reservation_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role_val TEXT;
  can_unassign BOOLEAN;
BEGIN
  -- Get user role
  SELECT role INTO user_role_val 
  FROM public.user_profiles 
  WHERE user_id = auth.uid();

  -- Check permissions: master OR has gestao_faxinas_reassign permission
  IF user_role_val = 'master' THEN
    can_unassign := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM user_permissions perm
      WHERE perm.user_id = auth.uid() 
      AND perm.permission_type IN ('gestao_faxinas_reassign', 'gestao_faxinas_manage')
      AND perm.permission_value = true
    ) INTO can_unassign;
  END IF;

  IF NOT can_unassign THEN
    RAISE EXCEPTION 'Acesso negado: sem permissão para remover faxineiras';
  END IF;

  -- Remove a faxineira da reserva
  UPDATE public.reservations
  SET cleaner_user_id = NULL,
      cleaning_status = 'Pendente'
  WHERE id = reservation_id;
  
  IF FOUND THEN
    RETURN 'SUCESSO: Faxineira removida da faxina.';
  ELSE
    RAISE EXCEPTION 'FALHA_UPDATE: Reserva não encontrada.';
  END IF;
END;
$$;