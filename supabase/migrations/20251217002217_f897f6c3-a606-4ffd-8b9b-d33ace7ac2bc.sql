-- =================================================================
-- FASE 1: Trigger para Auto-Criar notification_destinations para Faxineiras
-- =================================================================

-- Função que será chamada pelo trigger
CREATE OR REPLACE FUNCTION public.auto_create_cleaner_notification_destination()
RETURNS TRIGGER AS $$
BEGIN
  -- Só executa se o role for 'faxineira'
  IF NEW.role = 'faxineira' THEN
    INSERT INTO public.notification_destinations (
      user_id,
      destination_name,
      destination_role,
      whatsapp_number,
      is_authenticated,
      preferences
    )
    SELECT 
      NEW.user_id,
      COALESCE(NEW.full_name, 'Faxineira'),
      'faxineira',
      COALESCE(cp.phone, '-'),
      false,
      '{"cleaner_assignment": true, "cleaner_48h": true, "cleaner_24h": true, "cleaner_day_of_alerts": true}'::jsonb
    FROM (SELECT 1) dummy
    LEFT JOIN public.cleaner_profiles cp ON cp.user_id = NEW.user_id
    ON CONFLICT (user_id, destination_role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger no user_profiles
DROP TRIGGER IF EXISTS trigger_auto_create_cleaner_notification ON public.user_profiles;
CREATE TRIGGER trigger_auto_create_cleaner_notification
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_cleaner_notification_destination();

-- =================================================================
-- FASE 2: Constraint Unique para Evitar Duplicatas
-- =================================================================

-- Garantir que não haja duplicatas de user_id + destination_role
ALTER TABLE public.notification_destinations 
ADD CONSTRAINT unique_user_destination_role 
UNIQUE (user_id, destination_role);

-- =================================================================
-- FASE 3: Inserir Faxineiras Existentes que Estão Faltando
-- =================================================================

-- Inserir TODAS as faxineiras que ainda não têm notification_destinations
INSERT INTO public.notification_destinations (
  user_id,
  destination_name,
  destination_role,
  whatsapp_number,
  is_authenticated,
  preferences
)
SELECT 
  up.user_id,
  COALESCE(up.full_name, 'Faxineira'),
  'faxineira',
  COALESCE(cp.phone, '-'),
  false,
  '{"cleaner_assignment": true, "cleaner_48h": true, "cleaner_24h": true, "cleaner_day_of_alerts": true}'::jsonb
FROM user_profiles up
LEFT JOIN cleaner_profiles cp ON up.user_id = cp.user_id
WHERE up.role = 'faxineira'
AND NOT EXISTS (
  SELECT 1 FROM notification_destinations nd 
  WHERE nd.user_id = up.user_id AND nd.destination_role = 'faxineira'
)
ON CONFLICT (user_id, destination_role) DO NOTHING;

-- =================================================================
-- FASE 4: Atualizar Preferências de Destinatários Existentes
-- =================================================================

-- Atualizar co-anfitriões com novas preferências (merge com existentes)
UPDATE public.notification_destinations
SET preferences = COALESCE(preferences, '{}'::jsonb) || jsonb_build_object(
  'checkin_reminders', COALESCE((preferences->>'checkin_reminders')::boolean, true),
  'checkin_today', COALESCE((preferences->>'checkin_today')::boolean, true),
  'checkout_review', COALESCE((preferences->>'checkout_review')::boolean, true),
  'new_booking_alert', COALESCE((preferences->>'new_booking_alert')::boolean, true),
  'cleaning_risk', COALESCE((preferences->>'cleaning_risk')::boolean, true)
)
WHERE destination_role IN ('co-anfitriao', 'gestor');

-- Atualizar proprietários com preferências
UPDATE public.notification_destinations
SET preferences = COALESCE(preferences, '{}'::jsonb) || jsonb_build_object(
  'checkin_reminders', COALESCE((preferences->>'checkin_reminders')::boolean, true),
  'payment_notifications', COALESCE((preferences->>'payment_notifications')::boolean, true),
  'new_booking_alert', COALESCE((preferences->>'new_booking_alert')::boolean, true)
)
WHERE destination_role = 'proprietario';

-- Atualizar faxineiras que têm preferences NULL ou incompletas
UPDATE public.notification_destinations
SET preferences = jsonb_build_object(
  'cleaner_assignment', true,
  'cleaner_48h', true,
  'cleaner_24h', true,
  'cleaner_day_of_alerts', true
)
WHERE destination_role = 'faxineira' 
AND (preferences IS NULL OR preferences = '{}'::jsonb);