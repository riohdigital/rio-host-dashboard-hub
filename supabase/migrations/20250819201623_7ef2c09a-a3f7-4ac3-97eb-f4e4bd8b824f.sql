-- Função para buscar todas as reservas de faxinas (visão master)
CREATE OR REPLACE FUNCTION public.fn_get_all_cleaner_reservations()
RETURNS TABLE(
  id uuid, property_id uuid, platform text, reservation_code text, 
  check_in_date date, check_out_date date, payment_date date, 
  total_revenue numeric, payment_status text, reservation_status text, 
  created_at timestamp with time zone, guest_name text, number_of_guests integer,
  base_revenue numeric, commission_amount numeric, net_revenue numeric, 
  checkin_time time without time zone, checkout_time time without time zone,
  is_communicated boolean, receipt_sent boolean, guest_phone text,
  cleaner_user_id uuid, cleaning_payment_status text, cleaning_rating integer,
  cleaning_notes text, cleaning_fee numeric, cleaning_allocation text,
  cleaning_status text, next_check_in_date date, next_checkin_time time without time zone,
  properties json, cleaner_info json
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    WHERE r.cleaner_user_id IS NOT NULL OR r.cleaning_status = 'Pendente'
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
$$;

-- Função para buscar todas as reservas disponíveis (sem faxineira atribuída)
CREATE OR REPLACE FUNCTION public.fn_get_all_available_reservations()
RETURNS TABLE(
  id uuid, property_id uuid, platform text, reservation_code text, 
  check_in_date date, check_out_date date, payment_date date, 
  total_revenue numeric, payment_status text, reservation_status text, 
  created_at timestamp with time zone, guest_name text, number_of_guests integer,
  base_revenue numeric, commission_amount numeric, net_revenue numeric, 
  checkin_time time without time zone, checkout_time time without time zone,
  is_communicated boolean, receipt_sent boolean, guest_phone text,
  cleaner_user_id uuid, cleaning_payment_status text, cleaning_rating integer,
  cleaning_notes text, cleaning_fee numeric, cleaning_allocation text,
  cleaning_status text, next_check_in_date date, next_checkin_time time without time zone,
  properties json
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  WHERE rd.cleaner_user_id IS NULL
    AND rd.reservation_status IN ('Confirmada', 'Em Andamento', 'Finalizada')
    AND rd.cleaning_status = 'Pendente' 
    AND rd.check_out_date BETWEEN (CURRENT_DATE - INTERVAL '3 days') AND (CURRENT_DATE + INTERVAL '14 days')
  ORDER BY rd.check_out_date ASC;
END;
$$;

-- Função para reassignar faxina (apenas master)
CREATE OR REPLACE FUNCTION public.master_reassign_cleaning(
  reservation_id uuid, 
  new_cleaner_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verifica se o usuário é master
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = auth.uid() AND role = 'master'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas usuários master podem reassignar faxinas';
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
  
  -- Verifica se a atualização foi bem-sucedida
  IF FOUND THEN
    RETURN 'SUCESSO: Faxina reassignada com sucesso.';
  ELSE
    RAISE EXCEPTION 'FALHA_UPDATE: Reserva não encontrada.';
  END IF;
END;
$$;

-- Função para remover faxineira de uma reserva (apenas master)
CREATE OR REPLACE FUNCTION public.master_unassign_cleaning(reservation_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verifica se o usuário é master
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = auth.uid() AND role = 'master'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas usuários master podem remover faxineiras';
  END IF;

  -- Remove a faxineira da reserva
  UPDATE public.reservations
  SET cleaner_user_id = NULL,
      cleaning_status = 'Pendente'
  WHERE id = reservation_id;
  
  -- Verifica se a atualização foi bem-sucedida
  IF FOUND THEN
    RETURN 'SUCESSO: Faxineira removida da faxina.';
  ELSE
    RAISE EXCEPTION 'FALHA_UPDATE: Reserva não encontrada.';
  END IF;
END;
$$;