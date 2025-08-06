-- Fix infinite recursion in user_property_access policies
DROP POLICY IF EXISTS "Users can view own property access" ON user_property_access;
DROP POLICY IF EXISTS "Users can create access for themselves" ON user_property_access;

-- Create new policies without recursion
CREATE POLICY "Users can view own property access" 
ON user_property_access 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create access for themselves" 
ON user_property_access 
FOR INSERT 
WITH CHECK (user_id = auth.uid());