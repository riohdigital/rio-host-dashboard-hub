-- Primeiro, remover as políticas que dependem da função get_current_user_role
DROP POLICY IF EXISTS "Master users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Master users can update all profiles" ON public.user_profiles;  
DROP POLICY IF EXISTS "Master users can insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Master users can delete profiles" ON public.user_profiles;

-- Agora podemos remover a função
DROP FUNCTION IF EXISTS public.get_current_user_role();

-- Recriar a função corrigida
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role 
  FROM public.user_profiles 
  WHERE user_id = auth.uid();
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Recriar as políticas para user_profiles usando a função corrigida
CREATE POLICY "Master users can view all profiles" ON public.user_profiles
  FOR SELECT USING (public.get_current_user_role() = 'master');

CREATE POLICY "Master users can update all profiles" ON public.user_profiles
  FOR UPDATE USING (public.get_current_user_role() = 'master');

CREATE POLICY "Master users can insert profiles" ON public.user_profiles
  FOR INSERT WITH CHECK (public.get_current_user_role() = 'master');

CREATE POLICY "Master users can delete profiles" ON public.user_profiles
  FOR DELETE USING (public.get_current_user_role() = 'master');

-- Remover políticas problemáticas da tabela user_property_access
DROP POLICY IF EXISTS "Users can view own property access" ON public.user_property_access;
DROP POLICY IF EXISTS "Master users can manage all property access" ON public.user_property_access;

-- Criar políticas RLS mais robustas para user_property_access
CREATE POLICY "Users can view own property access" ON public.user_property_access
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Master users can view all property access" ON public.user_property_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'master'
    )
  );

CREATE POLICY "Master users can insert property access" ON public.user_property_access
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'master'
    )
  );

CREATE POLICY "Master users can update property access" ON public.user_property_access
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'master'
    )
  );

CREATE POLICY "Master users can delete property access" ON public.user_property_access
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'master'
    )
  );