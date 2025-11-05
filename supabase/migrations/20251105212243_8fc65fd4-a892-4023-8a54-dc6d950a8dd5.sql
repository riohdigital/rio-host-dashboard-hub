-- ============================================
-- MIGRATION: Aprimoramento da tabela riohhost_chat_history (v2)
-- ============================================

-- 1. Adicionar created_at para ordenação temporal
ALTER TABLE riohhost_chat_history 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Adicionar user_id SEM foreign key (para permitir dados legados)
ALTER TABLE riohhost_chat_history 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- 3. Adicionar campos para as novas features
ALTER TABLE riohhost_chat_history 
ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE riohhost_chat_history 
ADD COLUMN IF NOT EXISTS reaction TEXT;

ALTER TABLE riohhost_chat_history 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- 4. Atualizar session_id existentes com user_id (migração de dados)
UPDATE riohhost_chat_history 
SET user_id = session_id::uuid 
WHERE user_id IS NULL 
  AND session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 5. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_chat_history_user_created 
  ON riohhost_chat_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_history_category 
  ON riohhost_chat_history(user_id, category);

CREATE INDEX IF NOT EXISTS idx_chat_history_archived 
  ON riohhost_chat_history(user_id, is_archived);

-- 6. Habilitar RLS
ALTER TABLE riohhost_chat_history ENABLE ROW LEVEL SECURITY;

-- 7. Policies de segurança
DROP POLICY IF EXISTS "Users can view own chat history" ON riohhost_chat_history;
CREATE POLICY "Users can view own chat history"
ON riohhost_chat_history FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own chat messages" ON riohhost_chat_history;
CREATE POLICY "Users can insert own chat messages"
ON riohhost_chat_history FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own chat messages" ON riohhost_chat_history;
CREATE POLICY "Users can update own chat messages"
ON riohhost_chat_history FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own chat history" ON riohhost_chat_history;
CREATE POLICY "Users can delete own chat history"
ON riohhost_chat_history FOR DELETE
USING (user_id = auth.uid());

-- 8. Função helper para categorização automática
CREATE OR REPLACE FUNCTION categorize_message(content TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF content ~* 'caixa|receita|pagamento|faturamento|lucro|despesa|financeiro' THEN
    RETURN 'financeiro';
  ELSIF content ~* 'reserva|hospede|check-in|check-out|booking|airbnb' THEN
    RETURN 'reservas';
  ELSIF content ~* 'limpeza|faxina|limpar|limpador' THEN
    RETURN 'limpeza';
  ELSE
    RETURN 'geral';
  END IF;
END;
$$;

-- 9. Trigger para auto-categorização na inserção
CREATE OR REPLACE FUNCTION trigger_auto_categorize()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.category IS NULL THEN
    NEW.category := categorize_message(NEW.message->>'content');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_categorize_message ON riohhost_chat_history;
CREATE TRIGGER auto_categorize_message
  BEFORE INSERT ON riohhost_chat_history
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_categorize();

-- 10. View para estatísticas de uso
CREATE OR REPLACE VIEW chat_usage_stats AS
SELECT 
  user_id,
  COUNT(*) as total_messages,
  COUNT(*) FILTER (WHERE message->>'type' = 'human') as user_messages,
  COUNT(*) FILTER (WHERE message->>'type' = 'ai') as ai_messages,
  COUNT(*) FILTER (WHERE category = 'financeiro') as financial_queries,
  COUNT(*) FILTER (WHERE category = 'reservas') as reservation_queries,
  COUNT(*) FILTER (WHERE category = 'limpeza') as cleaning_queries,
  COUNT(*) FILTER (WHERE reaction = 'thumbs_up') as positive_reactions,
  COUNT(*) FILTER (WHERE reaction = 'thumbs_down') as negative_reactions,
  MAX(created_at) as last_activity
FROM riohhost_chat_history
WHERE user_id IS NOT NULL
GROUP BY user_id;

COMMENT ON TABLE riohhost_chat_history IS 'Histórico de conversas do chat IA com suporte a categorização e reações';