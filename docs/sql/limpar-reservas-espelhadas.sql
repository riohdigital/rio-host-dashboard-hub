-- =====================================================================
-- Limpeza de reservas duplicadas por calendários cruzados
--
-- Quando o calendário do Airbnb e o do Booking.com estão conectados um ao
-- outro, a mesma estadia aparece nos dois feeds: real numa plataforma e
-- "bloqueado" na outra. Versões anteriores da sincronização criavam uma
-- reserva para cada lado.
--
-- A partir da correção, esses espelhos são descartados automaticamente.
-- Este script serve para apagar os que já entraram antes disso.
--
-- Rode no SQL Editor do Supabase. O passo 1 é só consulta: confira o
-- resultado antes de executar o passo 2.
-- =====================================================================

-- 1. LISTAR os prováveis espelhos.
--    Critério: reserva criada pela sincronização, sem código real da
--    plataforma (SYNC-...), sem valor, e com outra reserva da mesma
--    propriedade cobrindo exatamente o mesmo período.
SELECT
  espelho.id,
  espelho.platform          AS plataforma_do_espelho,
  espelho.reservation_code  AS codigo_do_espelho,
  espelho.check_in_date,
  espelho.check_out_date,
  original.platform         AS plataforma_original,
  original.reservation_code AS codigo_original,
  original.guest_name       AS hospede,
  original.total_revenue    AS valor
FROM reservations espelho
JOIN reservations original
  ON original.property_id = espelho.property_id
 AND original.id <> espelho.id
 AND original.check_in_date  = espelho.check_in_date
 AND original.check_out_date = espelho.check_out_date
 AND COALESCE(original.reservation_status, '') <> 'Cancelada'
 AND original.reservation_code NOT LIKE 'SYNC-%'
WHERE espelho.external_source LIKE 'ical_%'
  AND espelho.reservation_code LIKE 'SYNC-%'
  AND COALESCE(espelho.total_revenue, 0) = 0
  AND espelho.guest_name IS NULL
  AND espelho.platform <> original.platform
ORDER BY espelho.check_in_date;

-- 2. APAGAR os espelhos listados acima.
--    Execute apenas depois de conferir a lista do passo 1.
--
-- DELETE FROM reservations espelho
-- USING reservations original
-- WHERE original.property_id = espelho.property_id
--   AND original.id <> espelho.id
--   AND original.check_in_date  = espelho.check_in_date
--   AND original.check_out_date = espelho.check_out_date
--   AND COALESCE(original.reservation_status, '') <> 'Cancelada'
--   AND original.reservation_code NOT LIKE 'SYNC-%'
--   AND espelho.external_source LIKE 'ical_%'
--   AND espelho.reservation_code LIKE 'SYNC-%'
--   AND COALESCE(espelho.total_revenue, 0) = 0
--   AND espelho.guest_name IS NULL
--   AND espelho.platform <> original.platform;

-- 3. Limpar as pendências que apontavam para as reservas apagadas.
-- UPDATE reservation_sync_pending
-- SET status = 'dismissed', resolved_at = now()
-- WHERE status = 'pending'
--   AND reservation_id IS NOT NULL
--   AND reservation_id NOT IN (SELECT id FROM reservations);
