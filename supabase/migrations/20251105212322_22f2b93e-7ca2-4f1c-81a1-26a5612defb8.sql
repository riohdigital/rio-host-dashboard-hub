-- Corrigir avisos de segurança das funções do chat

-- 1. Atualizar função categorize_message com search_path
CREATE OR REPLACE FUNCTION categorize_message(content TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
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

-- 2. Atualizar função trigger_auto_categorize com search_path
CREATE OR REPLACE FUNCTION trigger_auto_categorize()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.category IS NULL THEN
    NEW.category := categorize_message(NEW.message->>'content');
  END IF;
  RETURN NEW;
END;
$$;