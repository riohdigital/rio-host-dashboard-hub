-- Inserir faxineiras existentes em notification_destinations com preferências default
-- Apenas se ainda não existirem
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
  COALESCE(up.full_name, up.email, 'Faxineira'),
  'faxineira',
  cp.phone,
  false,
  '{"cleaner_assignment": true, "cleaner_48h": true, "cleaner_24h": true, "cleaner_day_of_alerts": true}'::jsonb
FROM public.user_profiles up
JOIN public.cleaner_profiles cp ON up.user_id = cp.user_id
WHERE up.role = 'faxineira'
  AND up.is_active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM public.notification_destinations nd 
    WHERE nd.user_id = up.user_id 
      AND nd.destination_role = 'faxineira'
  );