-- Atualizar política de criação de propriedades para permitir novos usuários
DROP POLICY IF EXISTS "Users can create properties with permission" ON public.properties;

CREATE POLICY "Users can create properties with permission" 
ON public.properties 
FOR INSERT 
WITH CHECK (
  -- Master users can create unlimited properties
  (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'master'
  ))
  OR
  -- Users with properties_create permission can create up to 3 properties
  ((EXISTS (
    SELECT 1 FROM user_permissions perm
    JOIN user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'properties_create' 
    AND perm.permission_value = true
  )) AND (
    (SELECT count(*) FROM properties WHERE created_by = auth.uid()) < 3
  ))
  OR
  -- New authenticated users can create their first property (automatic)
  (auth.uid() IS NOT NULL AND (
    (SELECT count(*) FROM properties WHERE created_by = auth.uid()) = 0
  ))
);