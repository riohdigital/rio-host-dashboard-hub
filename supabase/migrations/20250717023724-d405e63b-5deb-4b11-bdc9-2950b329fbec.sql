-- Adicionar coluna created_by na tabela properties
ALTER TABLE public.properties 
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Migrar dados existentes: definir created_by baseado em quem tem acesso "full"
UPDATE public.properties 
SET created_by = (
  SELECT upa.user_id 
  FROM public.user_property_access upa 
  WHERE upa.property_id = properties.id 
  AND upa.access_level = 'full' 
  LIMIT 1
);

-- Atualizar política de criação de propriedades para usar created_by em vez de user_property_access
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
     -- Verificar limite de 3 propriedades usando created_by diretamente
     (SELECT COUNT(*) FROM public.properties 
      WHERE created_by = auth.uid()) < 3)
  );