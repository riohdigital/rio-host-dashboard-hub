-- Fix property access for users with property access
-- Add a policy that allows users with property access to view those properties

-- Drop existing problematic policy
DROP POLICY IF EXISTS "Users can view properties based on permissions" ON properties;

-- Create corrected policy for property viewing
CREATE POLICY "Users can view properties based on permissions" 
ON properties 
FOR SELECT 
USING (
  -- Master users see all
  (EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND role = 'master'
  )) 
  OR 
  -- Users with view_all permission see all
  (EXISTS (
    SELECT 1 FROM user_permissions perm
    JOIN user_profiles up ON up.user_id = perm.user_id
    WHERE up.user_id = auth.uid() 
    AND perm.permission_type = 'properties_view_all' 
    AND perm.permission_value = true
  )) 
  OR 
  -- Users with specific property access see those properties
  (EXISTS (
    SELECT 1 FROM user_property_access upa
    WHERE upa.user_id = auth.uid() 
    AND upa.property_id = properties.id
  ))
);