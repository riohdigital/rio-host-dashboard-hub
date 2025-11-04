-- Atualizar função para permitir múltiplas atribuições por usuários de gestão
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
  is_management_user BOOLEAN;
BEGIN
  -- Get user role
  SELECT role INTO user_role_val 
  FROM public.user_profiles 
  WHERE user_id = auth.uid();

  -- Check permissions: master OR has gestao_faxinas_assign permission
  IF user_role_val = 'master' THEN
    can_assign := true;
    is_management_user := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM user_permissions perm
      WHERE perm.user_id = auth.uid() 
      AND perm.permission_type IN ('gestao_faxinas_assign', 'gestao_faxinas_manage')
      AND perm.permission_value = true
    ) INTO can_assign;
    
    is_management_user := can_assign;
  END IF;

  IF NOT can_assign THEN
    RAISE EXCEPTION 'Acesso negado: sem permissão para atribuir faxinas';
  END IF;

  -- Pular verificação de faxina ativa se for usuário de gestão
  IF NOT is_management_user THEN
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
    
    -- Aplica a regra de negócio SOMENTE para não-gestores
    IF active_cleanings_count > 0 AND NOT is_urgent THEN
      RAISE EXCEPTION 'REGRA_VIOLADA: Usuário já possui uma faxina ativa.';
    END IF;
  END IF;

  -- Atualiza a reserva
  UPDATE public.reservations
  SET cleaner_user_id = cleaner_id
  WHERE id = reservation_id AND cleaner_user_id IS NULL;
  
  IF FOUND THEN
    RETURN 'SUCESSO: Faxina atribuída com sucesso.';
  ELSE
    RAISE EXCEPTION 'FALHA_UPDATE: A faxina pode já ter sido atribuída por outra pessoa.';
  END IF;
END;
$$;