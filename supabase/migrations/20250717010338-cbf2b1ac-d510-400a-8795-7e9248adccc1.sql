-- Adicionar constraint única e corrigir as permissões
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_user_permission_unique 
UNIQUE (user_id, permission_type);

-- Agora inserir as permissões básicas para o usuário natalflatsrn@gmail.com
INSERT INTO user_permissions (user_id, permission_type, permission_value)
VALUES 
  ('97d1e7ad-064e-45da-8c7f-ec1c2bd82f42', 'reservations_view_assigned', true),
  ('97d1e7ad-064e-45da-8c7f-ec1c2bd82f42', 'reservations_create', true),
  ('97d1e7ad-064e-45da-8c7f-ec1c2bd82f42', 'reservations_edit', true),
  ('97d1e7ad-064e-45da-8c7f-ec1c2bd82f42', 'properties_view_assigned', true),
  ('97d1e7ad-064e-45da-8c7f-ec1c2bd82f42', 'expenses_view', true)
ON CONFLICT (user_id, permission_type) DO UPDATE SET 
  permission_value = EXCLUDED.permission_value;