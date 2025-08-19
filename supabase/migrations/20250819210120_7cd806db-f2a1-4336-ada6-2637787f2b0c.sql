-- Criar função para buscar faxineiras baseado nas permissões do usuário
CREATE OR REPLACE FUNCTION public.fn_get_cleaners_for_properties(property_ids uuid[] DEFAULT NULL)
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
BEGIN
  -- Buscar role do usuário
  SELECT role INTO user_role_val 
  FROM public.user_profiles 
  WHERE user_id = auth.uid();

  -- Se for master, pode ver todas as faxineiras
  IF user_role_val = 'master' THEN
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

  -- Para outros usuários, buscar propriedades acessíveis
  SELECT array_agg(upa.property_id) INTO accessible_property_ids
  FROM public.user_property_access upa
  WHERE upa.user_id = auth.uid();

  -- Se property_ids for fornecido, intersectar com propriedades acessíveis
  IF property_ids IS NOT NULL THEN
    accessible_property_ids := (
      SELECT array_agg(pid)
      FROM unnest(property_ids) AS pid
      WHERE pid = ANY(accessible_property_ids)
    );
  END IF;

  -- Retornar faxineiras que têm acesso às propriedades do usuário
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
    AND (accessible_property_ids IS NULL OR cpr.property_id = ANY(accessible_property_ids));
END;
$function$;

-- Atualizar as RPC functions existentes para aceitar proprietários também
CREATE OR REPLACE FUNCTION public.fn_get_all_cleaner_reservations(start_date date DEFAULT '1900-01-01'::date, end_date date DEFAULT '2099-12-31'::date, property_ids uuid[] DEFAULT NULL::uuid[])
RETURNS TABLE(id uuid, property_id uuid, platform text, reservation_code text, check_in_date date, check_out_date date, payment_date date, total_revenue numeric, payment_status text, reservation_status text, created_at timestamp with time zone, guest_name text, number_of_guests integer, base_revenue numeric, commission_amount numeric, net_revenue numeric, checkin_time time without time zone, checkout_time time without time zone, is_communicated boolean, receipt_sent boolean, guest_phone text, cleaner_user_id uuid, cleaning_payment_status text, cleaning_rating integer, cleaning_notes text, cleaning_fee numeric, cleaning_allocation text, cleaning_status text, next_check_in_date date, next_checkin_time time without time zone, properties json, cleaner_info json)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role_val text;
  accessible_property_ids uuid[];
  filtered_property_ids uuid[];
BEGIN
  -- Buscar role do usuário
  SELECT role INTO user_role_val 
  FROM public.user_profiles 
  WHERE user_id = auth.uid();

  -- Se for master, pode ver tudo
  IF user_role_val = 'master' THEN
    filtered_property_ids := property_ids;
  ELSE
    -- Para outros usuários, buscar propriedades acessíveis
    SELECT array_agg(upa.property_id) INTO accessible_property_ids
    FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid();

    -- Se não tem acesso a nenhuma propriedade, retornar vazio
    IF accessible_property_ids IS NULL OR array_length(accessible_property_ids, 1) = 0 THEN
      RETURN;
    END IF;

    -- Filtrar property_ids com as propriedades acessíveis
    IF property_ids IS NOT NULL THEN
      filtered_property_ids := (
        SELECT array_agg(pid)
        FROM unnest(property_ids) AS pid
        WHERE pid = ANY(accessible_property_ids)
      );
    ELSE
      filtered_property_ids := accessible_property_ids;
    END IF;
  END IF;

  RETURN QUERY
  WITH reservation_details AS (
    SELECT
      r.*,
      LEAD(r.check_in_date) OVER (PARTITION BY r.property_id ORDER BY r.check_in_date) as next_check_in_date,
      LEAD(r.checkin_time) OVER (PARTITION BY r.property_id ORDER BY r.check_in_date) as next_checkin_time,
      json_build_object('id', p.id, 'name', p.name, 'address', p.address, 'default_checkin_time', p.default_checkin_time) as properties,
      CASE 
        WHEN r.cleaner_user_id IS NOT NULL THEN
          json_build_object(
            'id', up.user_id, 
            'full_name', up.full_name, 
            'email', up.email,
            'phone', cp.phone
          )
        ELSE NULL
      END as cleaner_info
    FROM public.reservations r
    JOIN public.properties p ON r.property_id = p.id
    LEFT JOIN public.user_profiles up ON r.cleaner_user_id = up.user_id
    LEFT JOIN public.cleaner_profiles cp ON r.cleaner_user_id = cp.user_id
    WHERE (r.cleaner_user_id IS NOT NULL OR r.cleaning_status = 'Pendente')
      AND r.check_out_date >= start_date 
      AND r.check_out_date <= end_date
      AND (filtered_property_ids IS NULL OR r.property_id = ANY(filtered_property_ids))
  )
  SELECT
    rd.id, rd.property_id, rd.platform, rd.reservation_code, rd.check_in_date, 
    rd.check_out_date, rd.payment_date, rd.total_revenue, rd.payment_status, 
    rd.reservation_status, rd.created_at, rd.guest_name, rd.number_of_guests, 
    rd.base_revenue, rd.commission_amount, rd.net_revenue, rd.checkin_time, 
    rd.checkout_time, rd.is_communicated, rd.receipt_sent, rd.guest_phone, 
    rd.cleaner_user_id, rd.cleaning_payment_status, rd.cleaning_rating, 
    rd.cleaning_notes, rd.cleaning_fee, rd.cleaning_allocation, rd.cleaning_status, 
    rd.next_check_in_date, rd.next_checkin_time, rd.properties, rd.cleaner_info
  FROM reservation_details rd
  ORDER BY rd.check_out_date DESC;
END;
$function$;

-- Atualizar fn_get_all_available_reservations também
CREATE OR REPLACE FUNCTION public.fn_get_all_available_reservations(start_date date DEFAULT '1900-01-01'::date, end_date date DEFAULT '2099-12-31'::date, property_ids uuid[] DEFAULT NULL::uuid[])
RETURNS TABLE(id uuid, property_id uuid, platform text, reservation_code text, check_in_date date, check_out_date date, payment_date date, total_revenue numeric, payment_status text, reservation_status text, created_at timestamp with time zone, guest_name text, number_of_guests integer, base_revenue numeric, commission_amount numeric, net_revenue numeric, checkin_time time without time zone, checkout_time time without time zone, is_communicated boolean, receipt_sent boolean, guest_phone text, cleaner_user_id uuid, cleaning_payment_status text, cleaning_rating integer, cleaning_notes text, cleaning_fee numeric, cleaning_allocation text, cleaning_status text, next_check_in_date date, next_checkin_time time without time zone, properties json)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role_val text;
  accessible_property_ids uuid[];
  filtered_property_ids uuid[];
BEGIN
  -- Buscar role do usuário
  SELECT role INTO user_role_val 
  FROM public.user_profiles 
  WHERE user_id = auth.uid();

  -- Se for master, pode ver tudo
  IF user_role_val = 'master' THEN
    filtered_property_ids := property_ids;
  ELSE
    -- Para outros usuários, buscar propriedades acessíveis
    SELECT array_agg(upa.property_id) INTO accessible_property_ids
    FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid();

    -- Se não tem acesso a nenhuma propriedade, retornar vazio
    IF accessible_property_ids IS NULL OR array_length(accessible_property_ids, 1) = 0 THEN
      RETURN;
    END IF;

    -- Filtrar property_ids com as propriedades acessíveis
    IF property_ids IS NOT NULL THEN
      filtered_property_ids := (
        SELECT array_agg(pid)
        FROM unnest(property_ids) AS pid
        WHERE pid = ANY(accessible_property_ids)
      );
    ELSE
      filtered_property_ids := accessible_property_ids;
    END IF;
  END IF;

  RETURN QUERY
  WITH reservation_details AS (
    SELECT
      r.*,
      LEAD(r.check_in_date) OVER (PARTITION BY r.property_id ORDER BY r.check_in_date) as next_check_in_date,
      LEAD(r.checkin_time) OVER (PARTITION BY r.property_id ORDER BY r.check_in_date) as next_checkin_time,
      json_build_object('id', p.id, 'name', p.name, 'address', p.address, 'default_checkin_time', p.default_checkin_time) as properties
    FROM public.reservations r
    JOIN public.properties p ON r.property_id = p.id
    WHERE r.cleaner_user_id IS NULL
      AND r.reservation_status IN ('Confirmada', 'Em Andamento', 'Finalizada')
      AND r.cleaning_status = 'Pendente' 
      AND r.check_out_date >= start_date 
      AND r.check_out_date <= end_date
      AND (filtered_property_ids IS NULL OR r.property_id = ANY(filtered_property_ids))
  )
  SELECT
    rd.id, rd.property_id, rd.platform, rd.reservation_code, rd.check_in_date, 
    rd.check_out_date, rd.payment_date, rd.total_revenue, rd.payment_status, 
    rd.reservation_status, rd.created_at, rd.guest_name, rd.number_of_guests, 
    rd.base_revenue, rd.commission_amount, rd.net_revenue, rd.checkin_time, 
    rd.checkout_time, rd.is_communicated, rd.receipt_sent, rd.guest_phone, 
    rd.cleaner_user_id, rd.cleaning_payment_status, rd.cleaning_rating, 
    rd.cleaning_notes, rd.cleaning_fee, rd.cleaning_allocation, rd.cleaning_status, 
    rd.next_check_in_date, rd.next_checkin_time, rd.properties
  FROM reservation_details rd
  ORDER BY rd.check_out_date ASC;
END;
$function$;