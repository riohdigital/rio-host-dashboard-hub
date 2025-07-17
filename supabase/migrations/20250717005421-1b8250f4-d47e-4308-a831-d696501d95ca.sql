-- Corrigir política RLS crítica na tabela reservations
-- O problema está na condição "upa.property_id = upa.property_id" que sempre retorna true
-- Deve ser "upa.property_id = reservations.property_id" para filtrar corretamente

DROP POLICY IF EXISTS "Users can view reservations based on permissions" ON public.reservations;

CREATE POLICY "Users can view reservations based on permissions" 
ON public.reservations 
FOR SELECT 
USING (
  -- Master users têm acesso total
  (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  )) 
  OR 
  -- Usuários com permissão reservations_view_all podem ver todas
  (EXISTS (
    SELECT 1 FROM user_permissions perm
    JOIN user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'reservations_view_all' 
    AND perm.permission_value = true
  )) 
  OR 
  -- Usuários com permissão reservations_view_assigned podem ver apenas das propriedades atribuídas
  ((EXISTS (
    SELECT 1 FROM user_permissions perm
    JOIN user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'reservations_view_assigned' 
    AND perm.permission_value = true
  )) AND (EXISTS (
    SELECT 1 FROM user_property_access upa 
    WHERE upa.user_id = auth.uid() 
    AND upa.property_id = reservations.property_id
  )))
);