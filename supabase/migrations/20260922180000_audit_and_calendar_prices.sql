-- =====================================================================
-- RIOH HOST — AUDITORIA DE RESERVAS, SESSÕES & CALENDÁRIO DE TARIFAS
-- =====================================================================

-- 1. Campos de Auditoria de IA na tabela de reservas
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS is_verified_by_ai BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS platform_verified_data JSONB;

CREATE INDEX IF NOT EXISTS idx_reservations_verified 
  ON public.reservations(is_verified_by_ai, reservation_status);

COMMENT ON COLUMN public.reservations.is_verified_by_ai IS 
  'Indica se o Agente Navegador conferiu a reserva diretamente na plataforma oficial (Airbnb/Booking).';
COMMENT ON COLUMN public.reservations.verified_at IS 
  'Data e hora da última auditoria realizada pelo Agente Navegador.';
COMMENT ON COLUMN public.reservations.verification_notes IS 
  'Histórico de conferência e divergências corrigidas (taxas, comissões, cota coanfitrião).';
COMMENT ON COLUMN public.reservations.platform_verified_data IS 
  'Snapshot bruto dos dados extraídos da tela da reserva na plataforma.';

-- 2. Tabela de Sessões e Cookies Persistentes do Navegador
CREATE TABLE IF NOT EXISTS public.agent_browser_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL, -- 'airbnb.com.br', 'admin.booking.com'
    session_name VARCHAR(255) NOT NULL DEFAULT 'default',
    cookies_encrypted TEXT,
    local_storage_encrypted TEXT,
    session_storage_encrypted TEXT,
    user_agent TEXT,
    is_valid BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_domain_session UNIQUE (domain, session_name)
);

COMMENT ON TABLE public.agent_browser_sessions IS 
  'Armazenamento seguro de sessões web e cookies persistentes de anfitrião para o Agente Navegador Rioh Host';

-- 3. Tabela de Calendário de Preços Reais por Propriedade e Data
CREATE TABLE IF NOT EXISTS public.property_calendar_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  platform TEXT NOT NULL DEFAULT 'airbnb', -- 'airbnb', 'booking'
  price_per_night NUMERIC(10,2) NOT NULL,
  min_nights INT DEFAULT 1,
  is_available BOOLEAN DEFAULT TRUE,
  is_blocked BOOLEAN DEFAULT FALSE,
  last_scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (property_id, platform, date)
);

CREATE INDEX IF NOT EXISTS idx_prop_calendar_prices_lookup 
  ON public.property_calendar_prices(property_id, date);

COMMENT ON TABLE public.property_calendar_prices IS 
  'Histórico diário de tarifas vigentes cadastradas no calendário de cada imóvel no Airbnb/Booking.';

-- 4. Gatilho Automático no Banco para Novas Reservas via Google Script (Gmail)
-- Dispara webhook para o n8n APENAS se a reserva veio por e-mail (Google Script)
-- Reservas criadas manualmente pelo gestor ou pelo BOT (Chat AI) NÃO disparam este gatilho.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.fn_notify_ai_audit_new_reservation()
RETURNS trigger AS $$
BEGIN
  -- Filtro de Origem: APENAS reservas inseridas pelo Google Script (e-mails do Airbnb/Booking)
  IF (NEW.created_by_source IN ('email_airbnb', 'email_booking') OR NEW.created_by_source LIKE 'email_%')
     AND (NEW.reservation_status IS NULL OR NEW.reservation_status NOT IN ('cancelled', 'cancelada')) THEN

    PERFORM net.http_post(
      url := 'https://n8n-n8n.dgyrua.easypanel.host/webhook/rioh-host-auditoria-reserva-criada',
      body := json_build_object(
        'id', NEW.id,
        'reservation_code', NEW.reservation_code,
        'platform', NEW.platform,
        'property_id', NEW.property_id,
        'check_in_date', NEW.check_in_date,
        'check_out_date', NEW.check_out_date,
        'total_revenue', NEW.total_revenue,
        'cleaning_fee', NEW.cleaning_fee,
        'created_by_source', NEW.created_by_source,
        'created_at', NEW.created_at
      )::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_ai_audit_new_reservation ON public.reservations;
CREATE TRIGGER trg_notify_ai_audit_new_reservation
  AFTER INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_ai_audit_new_reservation();

