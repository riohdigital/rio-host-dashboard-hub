-- Corrigir search_path nas funções que não possuem
-- Apenas corrijo as funções relacionadas a faxineiras que criamos ou modificamos

-- Atualizar fn_get_available_reservations
CREATE OR REPLACE FUNCTION public.fn_get_available_reservations(cleaner_id uuid)
 RETURNS TABLE(id uuid, property_id uuid, platform text, reservation_code text, check_in_date date, check_out_date date, payment_date date, total_revenue numeric, payment_status text, reservation_status text, created_at timestamp with time zone, guest_name text, number_of_guests integer, base_revenue numeric, commission_amount numeric, net_revenue numeric, checkin_time time without time zone, checkout_time time without time zone, is_communicated boolean, receipt_sent boolean, guest_phone text, cleaner_user_id uuid, cleaning_payment_status text, cleaning_rating integer, cleaning_notes text, cleaning_fee numeric, cleaning_allocation text, cleaning_status text, next_check_in_date date, next_checkin_time time without time zone, properties json)
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
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
      rd.id, rd.property_id, rd.platform, rd.reservation_code, rd.check_in_date, rd.check_out_date, rd.payment_date, rd.total_revenue, rd.payment_status, rd.reservation_status, rd.created_at, rd.guest_name, rd.number_of_guests, rd.base_revenue, rd.commission_amount, rd.net_revenue, rd.checkin_time, rd.checkout_time, rd.is_communicated, rd.receipt_sent, rd.guest_phone, rd.cleaner_user_id, rd.cleaning_payment_status, rd.cleaning_rating, rd.cleaning_notes, rd.cleaning_fee, rd.cleaning_allocation, rd.cleaning_status, rd.next_check_in_date, rd.next_checkin_time, rd.properties
    FROM
      reservation_details rd
    WHERE
      rd.cleaner_user_id IS NULL
      AND rd.property_id IN (SELECT cp.property_id FROM public.cleaner_properties cp WHERE cp.user_id = cleaner_id)
      AND rd.reservation_status IN ('Confirmada', 'Em Andamento', 'Finalizada')
      AND rd.cleaning_status = 'Pendente' 
      AND rd.check_out_date BETWEEN (CURRENT_DATE - INTERVAL '3 days') AND (CURRENT_DATE + INTERVAL '14 days');
END;
$function$;

-- Atualizar fn_get_cleaner_reservations
CREATE OR REPLACE FUNCTION public.fn_get_cleaner_reservations(cleaner_id uuid)
 RETURNS TABLE(id uuid, property_id uuid, platform text, reservation_code text, check_in_date date, check_out_date date, payment_date date, total_revenue numeric, payment_status text, reservation_status text, created_at timestamp with time zone, guest_name text, number_of_guests integer, base_revenue numeric, commission_amount numeric, net_revenue numeric, checkin_time time without time zone, checkout_time time without time zone, is_communicated boolean, receipt_sent boolean, guest_phone text, cleaner_user_id uuid, cleaning_payment_status text, cleaning_rating integer, cleaning_notes text, cleaning_fee numeric, cleaning_allocation text, cleaning_status text, next_check_in_date date, next_checkin_time time without time zone, properties json)
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
    RETURN QUERY
    WITH reservation_details AS (
      SELECT
        r.*,
        LEAD(r.check_in_date) OVER (PARTITION BY r.property_id ORDER BY r.check_in_date) as next_check_in_date,
        LEAD(r.checkin_time) OVER (PARTITION BY r.property_id ORDER BY r.check_in_date) as next_checkin_time,
        json_build_object('id', p.id, 'name', p.name, 'address', p.address, 'default_checkin_time', p.default_checkin_time) as properties
      FROM
        public.reservations r
      JOIN
        public.properties p ON r.property_id = p.id
    )
    SELECT
      rd.id,
      rd.property_id,
      rd.platform,
      rd.reservation_code,
      rd.check_in_date,
      rd.check_out_date,
      rd.payment_date,
      rd.total_revenue,
      rd.payment_status,
      rd.reservation_status,
      rd.created_at,
      rd.guest_name,
      rd.number_of_guests,
      rd.base_revenue,
      rd.commission_amount,
      rd.net_revenue,
      rd.checkin_time,
      rd.checkout_time,
      rd.is_communicated,
      rd.receipt_sent,
      rd.guest_phone,
      rd.cleaner_user_id,
      rd.cleaning_payment_status,
      rd.cleaning_rating,
      rd.cleaning_notes,
      rd.cleaning_fee,
      rd.cleaning_allocation,
      rd.cleaning_status,
      rd.next_check_in_date,
      rd.next_checkin_time,
      rd.properties
    FROM
      reservation_details rd
    WHERE
      rd.cleaner_user_id = cleaner_id;
END;
$function$;

-- Atualizar assign_cleaning_to_cleaner
CREATE OR REPLACE FUNCTION public.assign_cleaning_to_cleaner(reservation_id uuid, cleaner_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  active_cleanings_count INT;
  is_urgent BOOLEAN;
BEGIN
  -- 1. Verifica se a faxineira já tem uma faxina ativa
  SELECT count(*)
  INTO active_cleanings_count
  FROM public.reservations
  WHERE reservations.cleaner_user_id = cleaner_id AND reservations.cleaning_status = 'Pendente';

  -- 2. Verifica se a reserva alvo é urgente (exceção à regra)
  SELECT ( (r.check_out_date || ' ' || r.checkout_time)::timestamp - now() ) <= interval '24 hours'
  INTO is_urgent
  FROM public.reservations r
  WHERE r.id = reservation_id;
  
  -- 3. Aplica a regra de negócio
  IF active_cleanings_count > 0 AND NOT is_urgent THEN
    -- Se tem faxina ativa E a nova não é urgente, retorna um erro.
    RAISE EXCEPTION 'REGRA_VIOLADA: Usuário já possui uma faxina ativa.';
  ELSE
    -- Se não, prossegue com a atualização
    UPDATE public.reservations
    SET cleaner_user_id = cleaner_id
    WHERE id = reservation_id AND cleaner_user_id IS NULL; -- Garante que só se pode pegar uma faxina disponível
    
    -- Verifica se a atualização foi bem-sucedida
    IF FOUND THEN
      RETURN 'SUCESSO: Faxina assinada com sucesso.';
    ELSE
      RAISE EXCEPTION 'FALHA_UPDATE: A faxina pode já ter sido assinada por outra pessoa.';
    END IF;
  END IF;
END;
$function$;

-- Atualizar get_my_properties_count
CREATE OR REPLACE FUNCTION public.get_my_properties_count()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN (
    SELECT count(*)
    FROM public.properties
    WHERE properties.created_by = auth.uid()
  );
END;
$function$;