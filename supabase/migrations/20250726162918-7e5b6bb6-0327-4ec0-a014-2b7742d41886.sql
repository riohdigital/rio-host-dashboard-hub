-- Criar trigger para adicionar automaticamente acesso à propriedade para o criador
CREATE OR REPLACE FUNCTION public.handle_property_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir acesso completo para o criador da propriedade
  INSERT INTO public.user_property_access (user_id, property_id, access_level)
  VALUES (NEW.created_by, NEW.id, 'full')
  ON CONFLICT (user_id, property_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger que executa quando uma nova propriedade é criada
CREATE TRIGGER trigger_property_created
  AFTER INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_property_created();