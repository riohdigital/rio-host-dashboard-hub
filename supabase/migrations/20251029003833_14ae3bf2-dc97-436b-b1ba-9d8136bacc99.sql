-- Adicionar campos de rastreamento de criação às reservas
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS created_by_source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS automation_metadata jsonb;

-- Criar função para popular created_by automaticamente
CREATE OR REPLACE FUNCTION set_created_by()
RETURNS trigger AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para aplicar a função
DROP TRIGGER IF EXISTS trigger_set_created_by ON reservations;
CREATE TRIGGER trigger_set_created_by
BEFORE INSERT ON reservations
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_reservations_created_by ON reservations(created_by);
CREATE INDEX IF NOT EXISTS idx_reservations_created_by_source ON reservations(created_by_source);

-- Comentários para documentação
COMMENT ON COLUMN reservations.created_by IS 'UUID do usuário ou sistema que criou a reserva';
COMMENT ON COLUMN reservations.created_by_source IS 'Origem da criação: manual, n8n_automation, api, import';
COMMENT ON COLUMN reservations.automation_metadata IS 'Metadados adicionais para automações (workflow_id, execution_id, etc)';