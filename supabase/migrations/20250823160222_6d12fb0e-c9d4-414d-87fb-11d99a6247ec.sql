-- Fix fn_get_property_cleaners_for_user to include cleaners without cleaner_profiles entry
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

  -- Return all cleaners linked to the property - using LEFT JOIN for cleaner_profiles
  RETURN QUERY
  SELECT DISTINCT
    up.id,
    up.user_id,
    up.full_name,
    up.email,
    cp.phone,
    up.is_active
  FROM user_profiles up
  LEFT JOIN cleaner_profiles cp ON up.user_id = cp.user_id  -- Changed to LEFT JOIN
  INNER JOIN cleaner_properties cpr ON up.user_id = cpr.user_id
  WHERE cpr.property_id = p_property_id
    AND up.role = 'faxineira'
    AND up.is_active = true;
END;
$function$;

-- Add cleaner_profiles entry for Isa if missing
INSERT INTO public.cleaner_profiles (user_id, phone, address)
SELECT 
  up.user_id,
  NULL as phone,
  NULL as address
FROM user_profiles up
WHERE up.full_name = 'Isa'
  AND up.role = 'faxineira'
  AND NOT EXISTS (
    SELECT 1 FROM cleaner_profiles cp
    WHERE cp.user_id = up.user_id
  );

-- Also ensure all cleaners have a cleaner_profiles entry
INSERT INTO public.cleaner_profiles (user_id, phone, address)
SELECT 
  up.user_id,
  NULL as phone,
  NULL as address
FROM user_profiles up
WHERE up.role = 'faxineira'
  AND NOT EXISTS (
    SELECT 1 FROM cleaner_profiles cp
    WHERE cp.user_id = up.user_id
  );