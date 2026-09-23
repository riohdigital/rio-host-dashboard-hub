-- Migration: Suporte a Alertas de Modificação de Reserva (reservation_modified)
-- Atualiza a função fn_notify_ai_audit_new_reservation para detectar alterações em reservas ativas

CREATE OR REPLACE FUNCTION public.fn_notify_ai_audit_new_reservation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_should_audit boolean := false;
  v_event_type text := 'new_reservation';
BEGIN
  -- 1. Nova reserva inserida (via e-mail ou sincronização) ainda não auditada
  IF TG_OP = 'INSERT' THEN
    IF (NEW.created_by_source LIKE 'email_%' OR NEW.created_by_source LIKE 'ical_%' OR NEW.created_by_source IS NULL)
       AND (NEW.is_verified_by_ai IS NOT TRUE) THEN
      v_should_audit := true;
      v_event_type := CASE 
        WHEN NEW.reservation_status ILIKE '%cancelad%' THEN 'reservation_cancelled' 
        ELSE 'new_reservation' 
      END;
    END IF;

  -- 2. Atualização em reserva existente
  ELSIF TG_OP = 'UPDATE' THEN
    -- 2.1 Cancelamento de reserva que estava ativa
    IF (NEW.reservation_status ILIKE '%cancelad%')
       AND (OLD.reservation_status IS NULL OR OLD.reservation_status NOT ILIKE '%cancelad%')
       AND (NEW.is_verified_by_ai IS NOT TRUE OR NEW.verified_at < NOW() - INTERVAL '10 minutes') THEN
      v_should_audit := true;
      v_event_type := 'reservation_cancelled';

    -- 2.2 Alteração de datas, valores ou hóspedes em reserva confirmada
    ELSIF (NEW.reservation_status NOT ILIKE '%cancelad%')
       AND (OLD.reservation_status NOT ILIKE '%cancelad%')
       AND (
         NEW.check_in_date <> OLD.check_in_date OR
         NEW.check_out_date <> OLD.check_out_date OR
         NEW.total_revenue <> OLD.total_revenue OR
         COALESCE(NEW.number_of_guests, 0) <> COALESCE(OLD.number_of_guests, 0)
       )
       AND (NEW.is_verified_by_ai IS NOT TRUE OR NEW.verified_at < NOW() - INTERVAL '10 minutes') THEN
      v_should_audit := true;
      v_event_type := 'reservation_modified';
    END IF;
  END IF;

  -- Dispara o webhook da Auditoria no n8n se a condição foi atendida
  IF v_should_audit THEN
    PERFORM net.http_post(
      url := 'https://n8n-n8n.dgyrua.easypanel.host/webhook/rioh-host-auditoria-reserva-criada',
      body := json_build_object(
        'id', NEW.id,
        'reservation_id', NEW.id,
        'reservation_code', NEW.reservation_code,
        'platform', NEW.platform,
        'property_id', NEW.property_id,
        'check_in_date', NEW.check_in_date,
        'check_out_date', NEW.check_out_date,
        'total_revenue', NEW.total_revenue,
        'cleaning_fee', NEW.cleaning_fee,
        'created_by_source', NEW.created_by_source,
        'created_at', NEW.created_at,
        'reservation_status', NEW.reservation_status,
        'event_type', v_event_type,
        'action_timestamp', NOW()
      )::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$function$;
