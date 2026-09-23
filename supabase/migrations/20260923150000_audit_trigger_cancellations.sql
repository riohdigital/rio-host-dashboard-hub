-- =====================================================================
-- RIOH HOST — ATUALIZAÇÃO DO GATILHO DE AUDITORIA (NOVAS RESERVAS & CANCELAMENTOS)
-- =====================================================================

-- Atualiza a função de notificação do n8n para auditar novas reservas e cancelamentos
CREATE OR REPLACE FUNCTION public.fn_notify_ai_audit_new_reservation()
RETURNS trigger AS $$
DECLARE
  v_should_audit boolean := false;
  v_event_type text := 'new_reservation';
BEGIN
  -- 1. Nova reserva inserida (via e-mail ou sincronização) ainda não auditada
  IF TG_OP = 'INSERT' THEN
    IF (NEW.created_by_source LIKE 'email_%' OR NEW.created_by_source LIKE 'ical_%')
       AND (NEW.is_verified_by_ai IS NOT TRUE) THEN
      v_should_audit := true;
      v_event_type := CASE 
        WHEN NEW.reservation_status ILIKE '%cancelad%' THEN 'reservation_cancelled' 
        ELSE 'new_reservation' 
      END;
    END IF;

  -- 2. Atualização de status para Cancelada em reserva que estava ativa
  ELSIF TG_OP = 'UPDATE' THEN
    IF (NEW.reservation_status ILIKE '%cancelad%')
       AND (OLD.reservation_status IS NULL OR OLD.reservation_status NOT ILIKE '%cancelad%')
       -- Evita loop se a própria auditoria da IA acabou de carimbar
       AND (NEW.is_verified_by_ai IS NOT TRUE OR NEW.verified_at < NOW() - INTERVAL '10 minutes') THEN
      v_should_audit := true;
      v_event_type := 'reservation_cancelled';
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
        'event_type', v_event_type
      )::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garante que o trigger escuta tanto INSERT quanto UPDATE de status
DROP TRIGGER IF EXISTS trg_notify_ai_audit_new_reservation ON public.reservations;
CREATE TRIGGER trg_notify_ai_audit_new_reservation
  AFTER INSERT OR UPDATE OF reservation_status ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_ai_audit_new_reservation();

COMMENT ON FUNCTION public.fn_notify_ai_audit_new_reservation() IS 
  'Dispara o webhook de auditoria com IA no n8n ao criar reservas por e-mail ou ao detectar cancelamentos.';
