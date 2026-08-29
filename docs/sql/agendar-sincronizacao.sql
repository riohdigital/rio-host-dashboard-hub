-- =====================================================================
-- Agendamento da sincronização iCal dentro do próprio Supabase
--
-- ATENÇÃO: este arquivo NÃO deve ser commitado com o segredo preenchido.
-- Rode-o manualmente no SQL Editor do Supabase, substituindo os valores.
--
-- CAMINHO MAIS SIMPLES (recomendado): use a interface do painel em
--   Integrations > Cron > Create job
-- escolhendo Type = Supabase Edge Function, method POST, função
-- sync-channel-reservations, schedule */30 * * * * e o header x-sync-secret.
-- Nessa tela é preciso clicar antes em "Install pg_net extension": sem pg_net
-- as opções de HTTP Request e Edge Function ficam desabilitadas.
-- Use este SQL apenas se a sua tela de Cron não tiver o campo de headers.
--
-- Outras alternativas gratuitas:
--   * cron-job.org / EasyCron: POST na URL da função com o header x-sync-secret
--   * GitHub Actions com `on: schedule`
-- =====================================================================

-- Passo a passo clicável: docs/PASSO-A-PASSO-ATIVACAO.md

-- 1. Extensões necessárias (executar uma vez)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Guarde o segredo no Vault em vez de deixá-lo no agendamento
--    (Dashboard > Project Settings > Vault, ou o comando abaixo).
-- SELECT vault.create_secret('SEU_CHANNEL_SYNC_SECRET', 'channel_sync_secret');

-- 3. Agende a leitura dos calendários a cada 30 minutos.
SELECT cron.schedule(
  'sync-channel-reservations',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://cwcauobnbmzjpqjmmomc.supabase.co/functions/v1/sync-channel-reservations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'channel_sync_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Conferir os agendamentos ativos:
--   SELECT * FROM cron.job;
-- Conferir as execuções:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- Remover o agendamento:
--   SELECT cron.unschedule('sync-channel-reservations');
