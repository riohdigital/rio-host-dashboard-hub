-- Corrigir política RLS para visualização de despesas
-- Usuários só podem ver despesas se tiverem permissão expenses_view
-- E das propriedades que têm acesso
DROP POLICY IF EXISTS "Users can view expenses based on permissions" ON public.expenses;

CREATE POLICY "Users can view expenses based on permissions" 
ON public.expenses 
FOR SELECT 
USING (
  -- Master users têm acesso total
  (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  )) 
  OR 
  -- Usuários com permissão expenses_view podem ver despesas 
  -- das propriedades que têm acesso
  ((EXISTS (
    SELECT 1 FROM user_permissions perm
    JOIN user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'expenses_view' 
    AND perm.permission_value = true
  )) AND (
    property_id IS NULL OR EXISTS (
      SELECT 1 FROM user_property_access upa 
      WHERE upa.user_id = auth.uid() 
      AND upa.property_id = expenses.property_id
    )
  ))
);