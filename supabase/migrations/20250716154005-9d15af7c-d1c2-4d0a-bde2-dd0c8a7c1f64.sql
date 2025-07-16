
-- Criar função security definer para obter o role do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Remover políticas existentes que causam recursão
DROP POLICY IF EXISTS "Master users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Master users can update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Master users can insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Master users can delete profiles" ON public.user_profiles;

-- Recriar políticas usando a função security definer (sem recursão)
CREATE POLICY "Master users can view all profiles" ON public.user_profiles
  FOR SELECT USING (public.get_current_user_role() = 'master');

CREATE POLICY "Master users can update all profiles" ON public.user_profiles
  FOR UPDATE USING (public.get_current_user_role() = 'master');

CREATE POLICY "Master users can insert profiles" ON public.user_profiles
  FOR INSERT WITH CHECK (public.get_current_user_role() = 'master');

CREATE POLICY "Master users can delete profiles" ON public.user_profiles
  FOR DELETE USING (public.get_current_user_role() = 'master');
