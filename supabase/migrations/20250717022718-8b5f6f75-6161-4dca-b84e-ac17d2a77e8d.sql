-- Adicionar política para permitir usuários criarem acesso para si mesmos
CREATE POLICY "Users can create access for themselves" ON public.user_property_access
  FOR INSERT 
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.properties WHERE id = property_id)
  );

-- Atualizar política de criação de propriedades para incluir limite de 3 propriedades para não-master
DROP POLICY IF EXISTS "Users can create properties with permission" ON public.properties;

CREATE POLICY "Users can create properties with permission" ON public.properties
  FOR INSERT 
  WITH CHECK (
    (EXISTS ( SELECT 1
       FROM user_profiles up
      WHERE ((up.user_id = auth.uid()) AND (up.role = 'master'::text)))) 
    OR 
    ((EXISTS ( SELECT 1
       FROM (user_permissions perm
         JOIN user_profiles up ON ((up.user_id = perm.user_id)))
      WHERE ((up.user_id = auth.uid()) AND (perm.permission_type = 'properties_create'::text) AND (perm.permission_value = true))))
     AND
     -- Verificar limite de 3 propriedades para usuários não-master
     (SELECT COUNT(*) FROM public.properties p 
      JOIN public.user_property_access upa ON p.id = upa.property_id 
      WHERE upa.user_id = auth.uid()) < 3)
  );