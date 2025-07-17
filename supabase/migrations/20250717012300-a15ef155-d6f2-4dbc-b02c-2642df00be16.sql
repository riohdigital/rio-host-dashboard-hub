-- Migração para corrigir problemas de autenticação e acesso às propriedades

-- Criar função de debugging para verificar contexto de autenticação
CREATE OR REPLACE FUNCTION public.debug_auth_context()
RETURNS TABLE (
  current_user_id uuid,
  current_role text,
  session_exists boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as current_user_id,
    (SELECT role FROM public.user_profiles WHERE user_id = auth.uid()) as current_role,
    (auth.uid() IS NOT NULL) as session_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Corrigir as políticas RLS para user_property_access com melhor debugging
DROP POLICY IF EXISTS "Master users can insert property access" ON public.user_property_access;

-- Criar política mais robusta para inserção de acesso às propriedades
CREATE POLICY "Master users can insert property access" ON public.user_property_access
  FOR INSERT WITH CHECK (
    -- Verificar se o usuário autenticado é master
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() 
      AND role = 'master'
      AND is_active = true
    )
  );

-- Criar política para permitir masters visualizar todos os acessos
DROP POLICY IF EXISTS "Master users can view all property access" ON public.user_property_access;

CREATE POLICY "Master users can view all property access" ON public.user_property_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() 
      AND role = 'master'
      AND is_active = true
    )
  );

-- Criar política para permitir masters atualizar todos os acessos
DROP POLICY IF EXISTS "Master users can update property access" ON public.user_property_access;

CREATE POLICY "Master users can update property access" ON public.user_property_access
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() 
      AND role = 'master'
      AND is_active = true
    )
  );

-- Criar política para permitir masters deletar todos os acessos
DROP POLICY IF EXISTS "Master users can delete property access" ON public.user_property_access;

CREATE POLICY "Master users can delete property access" ON public.user_property_access
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() 
      AND role = 'master'
      AND is_active = true
    )
  );

-- Função para verificar se um usuário pode gerenciar acessos às propriedades
CREATE OR REPLACE FUNCTION public.can_manage_property_access()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = auth.uid() 
    AND role = 'master'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;