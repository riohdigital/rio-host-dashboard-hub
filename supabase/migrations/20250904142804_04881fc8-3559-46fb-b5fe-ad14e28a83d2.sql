-- Fix critical security vulnerability in property_investments table
-- Replace overly permissive RLS policies with proper permission-based access control

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar investimentos" ON public.property_investments;
DROP POLICY IF EXISTS "Usuários autenticados podem criar investimentos" ON public.property_investments;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar investimentos" ON public.property_investments;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir investimentos" ON public.property_investments;

-- Create secure policies that follow the same pattern as other sensitive tables
-- Users can view investments with proper permissions and property access
CREATE POLICY "Users can view investments based on permissions" 
ON public.property_investments 
FOR SELECT 
USING (
  -- Master users can see all
  EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR (
    -- Users with investments_view permission can see investments for properties they have access to
    EXISTS (
      SELECT 1 FROM user_permissions perm
      JOIN user_profiles up ON up.user_id = perm.user_id
      WHERE up.user_id = auth.uid() 
      AND perm.permission_type = 'investments_view' 
      AND perm.permission_value = true
    ) AND EXISTS (
      SELECT 1 FROM user_property_access upa
      WHERE upa.user_id = auth.uid() 
      AND upa.property_id = property_investments.property_id
    )
  )
);

-- Users can create investments with proper permissions and property access
CREATE POLICY "Users can create investments with permission" 
ON public.property_investments 
FOR INSERT 
WITH CHECK (
  -- Master users can create all
  EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR (
    -- Users with investments_create permission can create investments for properties they have full access to
    EXISTS (
      SELECT 1 FROM user_permissions perm
      JOIN user_profiles up ON up.user_id = perm.user_id
      WHERE up.user_id = auth.uid() 
      AND perm.permission_type = 'investments_create' 
      AND perm.permission_value = true
    ) AND EXISTS (
      SELECT 1 FROM user_property_access upa
      WHERE upa.user_id = auth.uid() 
      AND upa.property_id = property_investments.property_id 
      AND upa.access_level = 'full'
    )
  )
);

-- Users can update investments with proper permissions and property access
CREATE POLICY "Users can update investments with permission" 
ON public.property_investments 
FOR UPDATE 
USING (
  -- Master users can update all
  EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR (
    -- Users with investments_create permission can update investments for properties they have access to
    EXISTS (
      SELECT 1 FROM user_permissions perm
      JOIN user_profiles up ON up.user_id = perm.user_id
      WHERE up.user_id = auth.uid() 
      AND perm.permission_type = 'investments_create' 
      AND perm.permission_value = true
    ) AND EXISTS (
      SELECT 1 FROM user_property_access upa
      WHERE upa.user_id = auth.uid() 
      AND upa.property_id = property_investments.property_id
    )
  )
);

-- Users can delete investments with proper permissions and property access
CREATE POLICY "Users can delete investments with permission" 
ON public.property_investments 
FOR DELETE 
USING (
  -- Master users can delete all
  EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR (
    -- Users with investments_create permission can delete investments for properties they have full access to
    EXISTS (
      SELECT 1 FROM user_permissions perm
      JOIN user_profiles up ON up.user_id = perm.user_id
      WHERE up.user_id = auth.uid() 
      AND perm.permission_type = 'investments_create' 
      AND perm.permission_value = true
    ) AND EXISTS (
      SELECT 1 FROM user_property_access upa
      WHERE upa.user_id = auth.uid() 
      AND upa.property_id = property_investments.property_id 
      AND upa.access_level = 'full'
    )
  )
);