-- Atualizar função para aceitar filtros de data e propriedades
CREATE OR REPLACE FUNCTION public.fn_get_all_cleaner_reservations(
  start_date DATE DEFAULT '1900-01-01',
  end_date DATE DEFAULT '2099-12-31',
  property_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid, property_id uuid, platform text, reservation_code text, check_in_date date, 
  check_out_date date, payment_date date, total_revenue numeric, payment_status text, 
  reservation_status text, created_at timestamp with time zone, guest_name text, 
  number_of_guests integer, base_revenue numeric, commission_amount numeric, net_revenue numeric, 
  checkin_time time without time zone, checkout_time time without time zone, 
  is_communicated boolean, receipt_sent boolean, guest_phone text, cleaner_user_id uuid, 
  cleaning_payment_status text, cleaning_rating integer, cleaning_notes text, 
  cleaning_fee numeric, cleaning_allocation text, cleaning_status text, 
  next_check_in_date date, next_checkin_time time without time zone, 
  properties json, cleaner_info json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verifica se o usuário é master
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = auth.uid() AND role = 'master'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas usuários master podem acessar esta função';
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
      AND (property_ids IS NULL OR r.property_id = ANY(property_ids))
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

-- Atualizar função para reservas disponíveis com filtros
CREATE OR REPLACE FUNCTION public.fn_get_all_available_reservations(
  start_date DATE DEFAULT '1900-01-01',
  end_date DATE DEFAULT '2099-12-31',
  property_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid, property_id uuid, platform text, reservation_code text, check_in_date date, 
  check_out_date date, payment_date date, total_revenue numeric, payment_status text, 
  reservation_status text, created_at timestamp with time zone, guest_name text, 
  number_of_guests integer, base_revenue numeric, commission_amount numeric, net_revenue numeric, 
  checkin_time time without time zone, checkout_time time without time zone, 
  is_communicated boolean, receipt_sent boolean, guest_phone text, cleaner_user_id uuid, 
  cleaning_payment_status text, cleaning_rating integer, cleaning_notes text, 
  cleaning_fee numeric, cleaning_allocation text, cleaning_status text, 
  next_check_in_date date, next_checkin_time time without time zone, properties json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verifica se o usuário é master
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = auth.uid() AND role = 'master'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas usuários master podem acessar esta função';
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
      AND (property_ids IS NULL OR r.property_id = ANY(property_ids))
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