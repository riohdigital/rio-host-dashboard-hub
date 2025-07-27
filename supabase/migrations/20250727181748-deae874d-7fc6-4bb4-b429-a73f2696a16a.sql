-- Corrigir problemas de segurança detectados pelo linter

-- Habilitar RLS nas tabelas que têm políticas mas RLS desabilitado
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_categories ENABLE ROW LEVEL SECURITY;

-- Corrigir search_path nas funções para segurança
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_property_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- Inserir acesso completo para o criador da propriedade
  INSERT INTO public.user_property_access (user_id, property_id, access_level)
  VALUES (NEW.created_by, NEW.id, 'full')
  ON CONFLICT (user_id, property_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role 
  FROM public.user_profiles 
  WHERE user_id = auth.uid();
  
  RETURN user_role;
END;
$function$;

CREATE OR REPLACE FUNCTION public.debug_auth_context()
 RETURNS TABLE(current_user_id uuid, user_role text, session_exists boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as current_user_id,
    (SELECT role FROM public.user_profiles WHERE user_id = auth.uid()) as user_role,
    (auth.uid() IS NOT NULL) as session_exists;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_property_access()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = auth.uid() 
    AND role = 'master'
    AND is_active = true
  );
END;
$function$;