-- Criar tabela de perfis de usuário
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('master', 'owner', 'editor', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de permissões de usuário
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  permission_type TEXT NOT NULL,
  permission_value BOOLEAN DEFAULT false,
  resource_id UUID, -- Para permissões específicas de propriedades
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, permission_type, resource_id)
);

-- Criar tabela de acesso a propriedades por usuário
CREATE TABLE public.user_property_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  access_level TEXT DEFAULT 'read_only' CHECK (access_level IN ('full', 'read_only', 'restricted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, property_id)
);

-- Função para criar perfil automaticamente quando usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE 
      WHEN NEW.email = 'victorugocosta@icloud.com' THEN 'master'
      ELSE 'viewer'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para executar a função
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at na tabela user_profiles
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS nas tabelas
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_property_access ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_profiles
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Master users can view all profiles" ON public.user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'master'
    )
  );

CREATE POLICY "Master users can update all profiles" ON public.user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'master'
    )
  );

CREATE POLICY "Master users can insert profiles" ON public.user_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'master'
    )
  );

CREATE POLICY "Master users can delete profiles" ON public.user_profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'master'
    )
  );

-- Políticas RLS para user_permissions
CREATE POLICY "Users can view own permissions" ON public.user_permissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Master users can manage all permissions" ON public.user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'master'
    )
  );

-- Políticas RLS para user_property_access
CREATE POLICY "Users can view own property access" ON public.user_property_access
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Master users can manage all property access" ON public.user_property_access
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'master'
    )
  );

-- Inserir o usuário mestre se ainda não existir (para usuários já cadastrados)
INSERT INTO public.user_profiles (user_id, email, full_name, role)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', ''),
  CASE 
    WHEN au.email = 'victorugocosta@icloud.com' THEN 'master'
    ELSE 'viewer'
  END
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.user_id = au.id
);

-- Conceder todas as permissões ao usuário mestre
INSERT INTO public.user_permissions (user_id, permission_type, permission_value)
SELECT 
  up.user_id,
  permission,
  true
FROM public.user_profiles up,
UNNEST(ARRAY[
  'properties_view_all',
  'properties_create',
  'properties_edit',
  'properties_delete',
  'reservations_view_all',
  'reservations_create',
  'reservations_edit',
  'reservations_delete',
  'expenses_view',
  'expenses_create',
  'expenses_edit',
  'investments_view',
  'investments_create',
  'dashboard_revenue',
  'dashboard_occupancy',
  'dashboard_expenses',
  'dashboard_profit',
  'users_manage',
  'system_settings'
]) AS permission
WHERE up.role = 'master'
ON CONFLICT (user_id, permission_type, resource_id) DO NOTHING;