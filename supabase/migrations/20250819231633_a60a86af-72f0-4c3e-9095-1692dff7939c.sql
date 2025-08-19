-- Fix fn_get_cleaners_for_properties to avoid ambiguous column references and handle master/non-master cases robustly
CREATE OR REPLACE FUNCTION public.fn_get_cleaners_for_properties(property_ids uuid[] DEFAULT NULL::uuid[])
RETURNS TABLE(
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  phone text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role_val text;
  accessible_property_ids uuid[];
  effective_property_ids uuid[];
BEGIN
  -- Determine current user's role
  SELECT up.role INTO user_role_val
  FROM public.user_profiles up
  WHERE up.user_id = auth.uid();

  -- If user is master and no specific property filter provided, return all active cleaners
  IF user_role_val = 'master' AND property_ids IS NULL THEN
    RETURN QUERY
    SELECT 
      up.id,
      up.user_id,
      up.full_name,
      up.email,
      cp.phone,
      up.is_active
    FROM public.user_profiles up
    LEFT JOIN public.cleaner_profiles cp ON up.user_id = cp.user_id
    WHERE up.role = 'faxineira' AND up.is_active = true;
    RETURN;
  END IF;

  -- Build allowed/effective property set
  IF user_role_val = 'master' THEN
    -- Master with property filter provided
    effective_property_ids := property_ids;  -- can be NULL as well
  ELSE
    -- Non-master: load properties the user can access
    SELECT array_agg(upa.property_id) INTO accessible_property_ids
    FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid();

    -- If has no access, return empty
    IF accessible_property_ids IS NULL OR array_length(accessible_property_ids, 1) = 0 THEN
      RETURN;
    END IF;

    -- Intersect requested property_ids with accessible ones (or use accessible if none provided)
    IF property_ids IS NOT NULL THEN
      effective_property_ids := (
        SELECT array_agg(pid)
        FROM unnest(property_ids) AS pid
        WHERE pid = ANY(accessible_property_ids)
      );
      IF effective_property_ids IS NULL OR array_length(effective_property_ids, 1) = 0 THEN
        RETURN;
      END IF;
    ELSE
      effective_property_ids := accessible_property_ids;
    END IF;
  END IF;

  -- If we reach here: either master with property filter, or non-master with effective properties
  RETURN QUERY
  SELECT DISTINCT
    up.id,
    up.user_id,
    up.full_name,
    up.email,
    cp.phone,
    up.is_active
  FROM public.user_profiles up
  LEFT JOIN public.cleaner_profiles cp ON up.user_id = cp.user_id
  INNER JOIN public.cleaner_properties cpr ON up.user_id = cpr.user_id
  WHERE up.role = 'faxineira'
    AND up.is_active = true
    AND (effective_property_ids IS NULL OR cpr.property_id = ANY(effective_property_ids));
END;
$function$;