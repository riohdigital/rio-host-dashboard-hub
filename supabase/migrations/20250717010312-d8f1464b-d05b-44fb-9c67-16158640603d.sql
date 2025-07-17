-- Corrigir as permissões básicas para o usuário natalflatsrn@gmail.com
-- Adicionar permissões necessárias para visualização de reservas atribuídas

INSERT INTO user_permissions (user_id, permission_type, permission_value)
VALUES 
  ('97d1e7ad-064e-45da-8c7f-ec1c2bd82f42', 'reservations_view_assigned', true),
  ('97d1e7ad-064e-45da-8c7f-ec1c2bd82f42', 'reservations_create', true),
  ('97d1e7ad-064e-45da-8c7f-ec1c2bd82f42', 'reservations_edit', true),
  ('97d1e7ad-064e-45da-8c7f-ec1c2bd82f42', 'properties_view_assigned', true),
  ('97d1e7ad-064e-45da-8c7f-ec1c2bd82f42', 'expenses_view', true)
ON CONFLICT (user_id, permission_type) DO UPDATE SET 
  permission_value = EXCLUDED.permission_value;

-- Testar inserção manual de acesso à propriedade
-- Primeiro, vamos verificar qual propriedade existe para teste
DO $$
DECLARE
  test_property_id uuid;
  test_user_id uuid := '97d1e7ad-064e-45da-8c7f-ec1c2bd82f42';
BEGIN
  -- Pegar a primeira propriedade disponível
  SELECT id INTO test_property_id FROM properties LIMIT 1;
  
  IF test_property_id IS NOT NULL THEN
    -- Inserir acesso à propriedade para teste
    INSERT INTO user_property_access (user_id, property_id, access_level)
    VALUES (test_user_id, test_property_id, 'full')
    ON CONFLICT (user_id, property_id) DO UPDATE SET
      access_level = EXCLUDED.access_level;
      
    RAISE NOTICE 'Propriedade % atribuída ao usuário com sucesso', test_property_id;
  ELSE
    RAISE NOTICE 'Nenhuma propriedade encontrada para teste';
  END IF;
END $$;