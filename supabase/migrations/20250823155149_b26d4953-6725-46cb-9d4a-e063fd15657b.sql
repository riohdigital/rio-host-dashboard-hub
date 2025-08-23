-- Fix ambiguous user_id references in fn_get_property_cleaners_for_user
CREATE OR REPLACE FUNCTION public.fn_get_property_cleaners_for_user(p_property_id uuid)
RETURNS TABLE(id uuid, user_id uuid, full_name text, email text, phone text, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role_val TEXT;
  has_property_access BOOLEAN;
  can_manage_cleaners BOOLEAN;
BEGIN
  -- Get user role
  SELECT role INTO user_role_val 
  FROM public.user_profiles 
  WHERE user_profiles.user_id = auth.uid();

  -- If master, can see all cleaners for the property
  IF user_role_val = 'master' THEN
    has_property_access := true;
    can_manage_cleaners := true;
  ELSE
    -- Check property access
    SELECT EXISTS (
      SELECT 1 FROM user_property_access upa
      WHERE upa.user_id = auth.uid() 
      AND upa.property_id = p_property_id
    ) INTO has_property_access;

    -- Check permissions for managing cleaners
    SELECT EXISTS (
      SELECT 1 FROM user_permissions perm
      WHERE perm.user_id = auth.uid() 
      AND perm.permission_type IN (
        'reservations_create', 
        'reservations_edit',
        'gestao_faxinas_assign',
        'gestao_faxinas_reassign',
        'gestao_faxinas_manage'
      )
      AND perm.permission_value = true
    ) INTO can_manage_cleaners;
  END IF;

  -- If no access or permissions, return empty
  IF NOT has_property_access OR NOT can_manage_cleaners THEN
    RETURN;
  END IF;

  -- Return all cleaners linked to the property
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
$function$;

-- Fix ambiguous references in fn_toggle_cleaning_status
CREATE OR REPLACE FUNCTION public.fn_toggle_cleaning_status(p_reservation_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_status TEXT;
  new_status TEXT;
  can_manage BOOLEAN;
  user_role_val TEXT;
BEGIN
  -- Check user role
  SELECT role INTO user_role_val 
  FROM public.user_profiles 
  WHERE user_profiles.user_id = auth.uid();

  -- Check permissions
  IF user_role_val = 'master' THEN
    can_manage := true;
  ELSE
    -- Check if has gestao_faxinas_manage permission
    SELECT EXISTS (
      SELECT 1 FROM user_permissions perm
      WHERE perm.user_id = auth.uid() 
      AND perm.permission_type = 'gestao_faxinas_manage'
      AND perm.permission_value = true
    ) INTO can_manage;
  END IF;

  IF NOT can_manage THEN
    RAISE EXCEPTION 'Sem permissão para alterar status de faxina';
  END IF;

  -- Get current status
  SELECT cleaning_status INTO current_status
  FROM reservations
  WHERE id = p_reservation_id;

  -- Toggle status
  IF current_status = 'Pendente' THEN
    new_status := 'Realizada';
  ELSE
    new_status := 'Pendente';
  END IF;

  -- Update status
  UPDATE reservations
  SET cleaning_status = new_status
  WHERE id = p_reservation_id;

  RETURN 'Status alterado para ' || new_status;
END;
$function$;

-- Ensure owners have the gestao_faxinas_manage permission
-- Add missing permissions for existing owners
INSERT INTO public.user_permissions (user_id, permission_type, permission_value)
SELECT DISTINCT up.user_id, 'gestao_faxinas_manage', true
FROM user_profiles up
WHERE up.role = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM user_permissions perm
    WHERE perm.user_id = up.user_id
    AND perm.permission_type = 'gestao_faxinas_manage'
  );

-- Also ensure owners have other gestao_faxinas permissions
INSERT INTO public.user_permissions (user_id, permission_type, permission_value)
SELECT DISTINCT up.user_id, perm_type.permission_type, true
FROM user_profiles up
CROSS JOIN (
  VALUES 
    ('gestao_faxinas_view'),
    ('gestao_faxinas_assign'),
    ('gestao_faxinas_reassign')
) AS perm_type(permission_type)
WHERE up.role = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM user_permissions perm
    WHERE perm.user_id = up.user_id
    AND perm.permission_type = perm_type.permission_type
  );