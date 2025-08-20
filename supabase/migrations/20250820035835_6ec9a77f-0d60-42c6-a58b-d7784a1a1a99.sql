-- Passo 1: Adicionar novo role 'gestor' ao enum
ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'gestor';

-- Passo 2: Migrar usuários existentes editor/viewer para gestor
UPDATE public.user_profiles 
SET role = 'gestor' 
WHERE role IN ('editor', 'viewer');

-- Passo 3: Verificar se existem usuários que se beneficiariam das novas permissões
-- Para usuários 'owner' que ainda não têm as novas permissões, vamos adicioná-las
INSERT INTO public.user_permissions (user_id, permission_type, permission_value)
SELECT 
  up.user_id,
  perm_type.permission_type,
  true
FROM public.user_profiles up
CROSS JOIN (
  VALUES 
    ('anfitriao_alerta_view'),
    ('anfitriao_alerta_manage'),
    ('gestao_faxinas_view')
) AS perm_type(permission_type)
WHERE up.role = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_permissions existing_perm 
    WHERE existing_perm.user_id = up.user_id 
    AND existing_perm.permission_type = perm_type.permission_type
  );

-- Passo 4: Para usuários 'gestor' (ex editor/viewer), dar apenas permissões de visualização
INSERT INTO public.user_permissions (user_id, permission_type, permission_value)
SELECT 
  up.user_id,
  perm_type.permission_type,
  true
FROM public.user_profiles up
CROSS JOIN (
  VALUES 
    ('anfitriao_alerta_view'),
    ('gestao_faxinas_view')
) AS perm_type(permission_type)
WHERE up.role = 'gestor'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_permissions existing_perm 
    WHERE existing_perm.user_id = up.user_id 
    AND existing_perm.permission_type = perm_type.permission_type
  );