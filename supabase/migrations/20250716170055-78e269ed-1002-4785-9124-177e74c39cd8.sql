-- Remove políticas RLS genéricas e cria políticas baseadas em permissões

-- PROPERTIES TABLE
DROP POLICY IF EXISTS "Enable read access for all users" ON public.properties;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.properties;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.properties;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON public.properties;

-- Políticas para properties baseadas em permissões
CREATE POLICY "Users can view properties based on permissions" ON public.properties
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR 
  EXISTS (
    SELECT 1 FROM public.user_permissions perm 
    JOIN public.user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'properties_view_all' 
    AND perm.permission_value = true
  ) OR
  EXISTS (
    SELECT 1 FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid() AND upa.property_id = id
  )
);

CREATE POLICY "Users can create properties with permission" ON public.properties
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR 
  EXISTS (
    SELECT 1 FROM public.user_permissions perm 
    JOIN public.user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'properties_create' 
    AND perm.permission_value = true
  )
);

CREATE POLICY "Users can update properties with permission" ON public.properties
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR 
  (EXISTS (
    SELECT 1 FROM public.user_permissions perm 
    JOIN public.user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'properties_edit' 
    AND perm.permission_value = true
  ) AND EXISTS (
    SELECT 1 FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid() AND upa.property_id = id AND upa.access_level IN ('full', 'read_only')
  ))
);

CREATE POLICY "Users can delete properties with permission" ON public.properties
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR 
  (EXISTS (
    SELECT 1 FROM public.user_permissions perm 
    JOIN public.user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'properties_delete' 
    AND perm.permission_value = true
  ) AND EXISTS (
    SELECT 1 FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid() AND upa.property_id = id AND upa.access_level = 'full'
  ))
);

-- RESERVATIONS TABLE
DROP POLICY IF EXISTS "Enable read access for all users" ON public.reservations;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.reservations;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.reservations;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON public.reservations;

-- Políticas para reservations baseadas em permissões
CREATE POLICY "Users can view reservations based on permissions" ON public.reservations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR 
  EXISTS (
    SELECT 1 FROM public.user_permissions perm 
    JOIN public.user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'reservations_view_all' 
    AND perm.permission_value = true
  ) OR
  (EXISTS (
    SELECT 1 FROM public.user_permissions perm 
    JOIN public.user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'reservations_view_assigned' 
    AND perm.permission_value = true
  ) AND EXISTS (
    SELECT 1 FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid() AND upa.property_id = property_id
  ))
);

CREATE POLICY "Users can create reservations with permission" ON public.reservations
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR 
  (EXISTS (
    SELECT 1 FROM public.user_permissions perm 
    JOIN public.user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'reservations_create' 
    AND perm.permission_value = true
  ) AND (property_id IS NULL OR EXISTS (
    SELECT 1 FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid() AND upa.property_id = reservations.property_id AND upa.access_level = 'full'
  )))
);

CREATE POLICY "Users can update reservations with permission" ON public.reservations
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR 
  (EXISTS (
    SELECT 1 FROM public.user_permissions perm 
    JOIN public.user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'reservations_edit' 
    AND perm.permission_value = true
  ) AND (property_id IS NULL OR EXISTS (
    SELECT 1 FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid() AND upa.property_id = property_id AND upa.access_level = 'full'
  )))
);

CREATE POLICY "Users can delete reservations with permission" ON public.reservations
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR 
  (EXISTS (
    SELECT 1 FROM public.user_permissions perm 
    JOIN public.user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'reservations_delete' 
    AND perm.permission_value = true
  ) AND (property_id IS NULL OR EXISTS (
    SELECT 1 FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid() AND upa.property_id = property_id AND upa.access_level = 'full'
  )))
);

-- EXPENSES TABLE
-- Enable RLS on expenses table
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Políticas para expenses baseadas em permissões
CREATE POLICY "Users can view expenses based on permissions" ON public.expenses
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR 
  EXISTS (
    SELECT 1 FROM public.user_permissions perm 
    JOIN public.user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'expenses_view' 
    AND perm.permission_value = true
  ) OR
  (property_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid() AND upa.property_id = expenses.property_id
  ))
);

CREATE POLICY "Users can create expenses with permission" ON public.expenses
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR 
  (EXISTS (
    SELECT 1 FROM public.user_permissions perm 
    JOIN public.user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'expenses_create' 
    AND perm.permission_value = true
  ) AND (property_id IS NULL OR EXISTS (
    SELECT 1 FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid() AND upa.property_id = expenses.property_id AND upa.access_level = 'full'
  )))
);

CREATE POLICY "Users can update expenses with permission" ON public.expenses
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR 
  (EXISTS (
    SELECT 1 FROM public.user_permissions perm 
    JOIN public.user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'expenses_edit' 
    AND perm.permission_value = true
  ) AND (property_id IS NULL OR EXISTS (
    SELECT 1 FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid() AND upa.property_id = property_id AND upa.access_level = 'full'
  )))
);

CREATE POLICY "Users can delete expenses with permission" ON public.expenses
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  ) OR 
  (EXISTS (
    SELECT 1 FROM public.user_permissions perm 
    JOIN public.user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'expenses_delete' 
    AND perm.permission_value = true
  ) AND (property_id IS NULL OR EXISTS (
    SELECT 1 FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid() AND upa.property_id = property_id AND upa.access_level = 'full'
  )))
);