-- Fix RLS policies with correct column references

-- Drop and recreate properties policies with correct references
DROP POLICY IF EXISTS "Users can delete properties with permission" ON public.properties;
DROP POLICY IF EXISTS "Users can update properties with permission" ON public.properties;

CREATE POLICY "Users can delete properties with permission" 
ON public.properties 
FOR DELETE 
USING (
  (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  )) OR (
    (EXISTS (
      SELECT 1 FROM user_permissions perm 
      JOIN user_profiles up ON up.user_id = perm.user_id
      WHERE up.user_id = auth.uid() 
        AND perm.permission_type = 'properties_delete' 
        AND perm.permission_value = true
    )) AND (
      EXISTS (
        SELECT 1 FROM user_property_access upa 
        WHERE upa.user_id = auth.uid() 
          AND upa.property_id = properties.id 
          AND upa.access_level = 'full'
      )
    )
  )
);

CREATE POLICY "Users can update properties with permission" 
ON public.properties 
FOR UPDATE 
USING (
  (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  )) OR (
    (EXISTS (
      SELECT 1 FROM user_permissions perm 
      JOIN user_profiles up ON up.user_id = perm.user_id
      WHERE up.user_id = auth.uid() 
        AND perm.permission_type = 'properties_edit' 
        AND perm.permission_value = true
    )) AND (
      EXISTS (
        SELECT 1 FROM user_property_access upa 
        WHERE upa.user_id = auth.uid() 
          AND upa.property_id = properties.id 
          AND upa.access_level IN ('full', 'read_only')
      )
    )
  )
);

-- Fix reservations policies
DROP POLICY IF EXISTS "Users can delete reservations with permission" ON public.reservations;
DROP POLICY IF EXISTS "Users can update reservations with permission" ON public.reservations;

CREATE POLICY "Users can delete reservations with permission" 
ON public.reservations 
FOR DELETE 
USING (
  (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  )) OR (
    (EXISTS (
      SELECT 1 FROM user_permissions perm 
      JOIN user_profiles up ON up.user_id = perm.user_id
      WHERE up.user_id = auth.uid() 
        AND perm.permission_type = 'reservations_delete' 
        AND perm.permission_value = true
    )) AND (
      property_id IS NULL OR EXISTS (
        SELECT 1 FROM user_property_access upa 
        WHERE upa.user_id = auth.uid() 
          AND upa.property_id = reservations.property_id 
          AND upa.access_level = 'full'
      )
    )
  )
);

CREATE POLICY "Users can update reservations with permission" 
ON public.reservations 
FOR UPDATE 
USING (
  (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  )) OR (
    (EXISTS (
      SELECT 1 FROM user_permissions perm 
      JOIN user_profiles up ON up.user_id = perm.user_id
      WHERE up.user_id = auth.uid() 
        AND perm.permission_type = 'reservations_edit' 
        AND perm.permission_value = true
    )) AND (
      property_id IS NULL OR EXISTS (
        SELECT 1 FROM user_property_access upa 
        WHERE upa.user_id = auth.uid() 
          AND upa.property_id = reservations.property_id 
          AND upa.access_level = 'full'
      )
    )
  )
);

-- Fix expenses policies
DROP POLICY IF EXISTS "Users can delete expenses with permission" ON public.expenses;
DROP POLICY IF EXISTS "Users can update expenses with permission" ON public.expenses;

CREATE POLICY "Users can delete expenses with permission" 
ON public.expenses 
FOR DELETE 
USING (
  (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  )) OR (
    (EXISTS (
      SELECT 1 FROM user_permissions perm 
      JOIN user_profiles up ON up.user_id = perm.user_id
      WHERE up.user_id = auth.uid() 
        AND perm.permission_type = 'expenses_delete' 
        AND perm.permission_value = true
    )) AND (
      property_id IS NULL OR EXISTS (
        SELECT 1 FROM user_property_access upa 
        WHERE upa.user_id = auth.uid() 
          AND upa.property_id = expenses.property_id 
          AND upa.access_level = 'full'
      )
    )
  )
);

CREATE POLICY "Users can update expenses with permission" 
ON public.expenses 
FOR UPDATE 
USING (
  (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'master'
  )) OR (
    (EXISTS (
      SELECT 1 FROM user_permissions perm 
      JOIN user_profiles up ON up.user_id = perm.user_id
      WHERE up.user_id = auth.uid() 
        AND perm.permission_type = 'expenses_edit' 
        AND perm.permission_value = true
    )) AND (
      property_id IS NULL OR EXISTS (
        SELECT 1 FROM user_property_access upa 
        WHERE upa.user_id = auth.uid() 
          AND upa.property_id = expenses.property_id 
          AND upa.access_level = 'full'
      )
    )
  )
);