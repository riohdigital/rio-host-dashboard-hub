-- =====================================================================
-- Sincronização automática de reservas (Airbnb / Booking.com)
--
-- Estratégia em dois canais complementares:
--   1) iCal  -> "esqueleto" da reserva (datas, bloqueios, código Airbnb)
--   2) E-mail -> "carne" da reserva (hóspede, valor, comissão, cancelamento)
--
-- Este migration cria as tabelas de configuração/auditoria e prepara a
-- tabela `reservations` para receber dados vindos de fontes externas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Campos de rastreio externo em reservations
-- ---------------------------------------------------------------------
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS external_uid text,
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

COMMENT ON COLUMN public.reservations.external_uid IS
  'Identificador do evento na origem (UID do iCal ou message-id do e-mail). Usado para idempotência.';
COMMENT ON COLUMN public.reservations.external_source IS
  'Origem externa do registro: ical_airbnb, ical_booking, email_airbnb, email_booking.';
COMMENT ON COLUMN public.reservations.last_synced_at IS
  'Última vez em que a reserva foi tocada por uma sincronização automática.';

-- Idempotência: um mesmo UID externo só pode existir uma vez por propriedade.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reservations_property_external_uid
  ON public.reservations (property_id, external_uid)
  WHERE external_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_platform_code
  ON public.reservations (platform, reservation_code);

CREATE INDEX IF NOT EXISTS idx_reservations_property_checkin
  ON public.reservations (property_id, check_in_date);

-- ---------------------------------------------------------------------
-- 2. Helpers de permissão (SECURITY DEFINER para evitar recursão em RLS)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_can_read_property(p_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'master'
    )
    OR EXISTS (
      SELECT 1 FROM public.user_permissions perm
      WHERE perm.user_id = auth.uid()
        AND perm.permission_type IN ('reservations_view_all', 'properties_view_all')
        AND perm.permission_value = true
    )
    OR (
      p_property_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_property_access upa
        WHERE upa.user_id = auth.uid() AND upa.property_id = p_property_id
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.sync_user_can_manage_property(p_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'master'
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.user_permissions perm
        WHERE perm.user_id = auth.uid()
          AND perm.permission_type IN ('properties_edit', 'reservations_create')
          AND perm.permission_value = true
      )
      AND (
        p_property_id IS NULL OR EXISTS (
          SELECT 1 FROM public.user_property_access upa
          WHERE upa.user_id = auth.uid()
            AND upa.property_id = p_property_id
            AND upa.access_level = 'full'
        )
      )
    );
$$;

COMMENT ON FUNCTION public.sync_user_can_read_property(uuid) IS
  'Retorna true se o usuário atual pode visualizar dados de sincronização da propriedade.';
COMMENT ON FUNCTION public.sync_user_can_manage_property(uuid) IS
  'Retorna true se o usuário atual pode configurar a sincronização da propriedade.';

-- ---------------------------------------------------------------------
-- 3. Fontes de sincronização (links iCal por propriedade/plataforma)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channel_sync_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('Airbnb', 'Booking.com')),
  source_type text NOT NULL DEFAULT 'ical' CHECK (source_type IN ('ical')),
  ical_url text,
  -- Nome do anúncio como aparece nos e-mails da plataforma (usado para
  -- casar e-mails com a propriedade correta quando há vários imóveis).
  listing_alias text,
  is_active boolean NOT NULL DEFAULT true,
  -- Se o DTEND do feed é a data de check-out (padrão Airbnb/Booking) ou a
  -- última noite ocupada (alguns feeds antigos).
  dtend_is_checkout boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_message text,
  last_content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  CONSTRAINT channel_sync_sources_ical_url_check
    CHECK (source_type <> 'ical' OR ical_url IS NOT NULL),
  CONSTRAINT channel_sync_sources_unique_channel
    UNIQUE (property_id, platform, source_type)
);

COMMENT ON TABLE public.channel_sync_sources IS
  'Links iCal exportados do Airbnb/Booking usados para importar reservas automaticamente.';

CREATE INDEX IF NOT EXISTS idx_channel_sync_sources_active
  ON public.channel_sync_sources (is_active, last_sync_at);

DROP TRIGGER IF EXISTS trg_channel_sync_sources_updated_at ON public.channel_sync_sources;
CREATE TRIGGER trg_channel_sync_sources_updated_at
  BEFORE UPDATE ON public.channel_sync_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.channel_sync_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sync sources visíveis por permissão" ON public.channel_sync_sources;
CREATE POLICY "Sync sources visíveis por permissão" ON public.channel_sync_sources
  FOR SELECT USING (public.sync_user_can_read_property(property_id));

DROP POLICY IF EXISTS "Sync sources criadas por permissão" ON public.channel_sync_sources;
CREATE POLICY "Sync sources criadas por permissão" ON public.channel_sync_sources
  FOR INSERT WITH CHECK (public.sync_user_can_manage_property(property_id));

DROP POLICY IF EXISTS "Sync sources editadas por permissão" ON public.channel_sync_sources;
CREATE POLICY "Sync sources editadas por permissão" ON public.channel_sync_sources
  FOR UPDATE USING (public.sync_user_can_manage_property(property_id))
  WITH CHECK (public.sync_user_can_manage_property(property_id));

DROP POLICY IF EXISTS "Sync sources removidas por permissão" ON public.channel_sync_sources;
CREATE POLICY "Sync sources removidas por permissão" ON public.channel_sync_sources
  FOR DELETE USING (public.sync_user_can_manage_property(property_id));

-- ---------------------------------------------------------------------
-- 4. Histórico de execuções
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channel_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.channel_sync_sources(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('ical', 'email')),
  platform text,
  status text NOT NULL CHECK (status IN ('success', 'partial', 'error', 'skipped')),
  events_found integer NOT NULL DEFAULT 0,
  reservations_created integer NOT NULL DEFAULT 0,
  reservations_updated integer NOT NULL DEFAULT 0,
  reservations_skipped integer NOT NULL DEFAULT 0,
  pending_created integer NOT NULL DEFAULT 0,
  message text,
  details jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

COMMENT ON TABLE public.channel_sync_runs IS
  'Auditoria de cada execução de sincronização (iCal ou e-mail).';

CREATE INDEX IF NOT EXISTS idx_channel_sync_runs_started
  ON public.channel_sync_runs (started_at DESC);

ALTER TABLE public.channel_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sync runs visíveis por permissão" ON public.channel_sync_runs;
CREATE POLICY "Sync runs visíveis por permissão" ON public.channel_sync_runs
  FOR SELECT USING (
    property_id IS NULL OR public.sync_user_can_read_property(property_id)
  );

-- ---------------------------------------------------------------------
-- 5. Fila de itens que precisam de conferência humana
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservation_sync_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('ical', 'email')),
  platform text,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'unmatched_property',
    'incomplete_data',
    'possible_cancellation',
    'conflict'
  )),
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE public.reservation_sync_pending IS
  'Itens detectados pela sincronização que não puderam ser aplicados automaticamente.';

CREATE INDEX IF NOT EXISTS idx_reservation_sync_pending_status
  ON public.reservation_sync_pending (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_reservation_sync_pending_updated_at ON public.reservation_sync_pending;
CREATE TRIGGER trg_reservation_sync_pending_updated_at
  BEFORE UPDATE ON public.reservation_sync_pending
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.reservation_sync_pending ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pendências visíveis por permissão" ON public.reservation_sync_pending;
CREATE POLICY "Pendências visíveis por permissão" ON public.reservation_sync_pending
  FOR SELECT USING (
    property_id IS NULL OR public.sync_user_can_read_property(property_id)
  );

DROP POLICY IF EXISTS "Pendências atualizadas por permissão" ON public.reservation_sync_pending;
CREATE POLICY "Pendências atualizadas por permissão" ON public.reservation_sync_pending
  FOR UPDATE USING (
    property_id IS NULL OR public.sync_user_can_manage_property(property_id)
  ) WITH CHECK (
    property_id IS NULL OR public.sync_user_can_manage_property(property_id)
  );

DROP POLICY IF EXISTS "Pendências removidas por permissão" ON public.reservation_sync_pending;
CREATE POLICY "Pendências removidas por permissão" ON public.reservation_sync_pending
  FOR DELETE USING (
    property_id IS NULL OR public.sync_user_can_manage_property(property_id)
  );
