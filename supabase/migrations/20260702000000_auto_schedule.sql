-- ============================================================
-- Migration : auto-schedule-elections
-- Configure pg_cron + pg_net pour déclencher la Edge Function
-- auto-schedule-elections toutes les minutes en arrière-plan.
-- ============================================================

-- S'assurer que les extensions nécessaires sont activées
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Permissions pg_cron
GRANT USAGE ON SCHEMA cron TO postgres;

-- Supprimer la tâche existante si elle existe (idempotence)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-open-elections') THEN
    PERFORM cron.unschedule('auto-open-elections');
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Stocker les secrets nécessaires dans le vault Supabase pour permettre à
-- pg_net de les lire dynamiquement (utilisé en prod).
-- En local, les valeurs connues sont inscrites directement dans la requête
-- via une fonction helper qui lit depuis vault ou retourne un défaut.
-- ─────────────────────────────────────────────────────────────────────────────

-- Stocker l'URL Supabase locale dans le vault (si pas encore présent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'SUPABASE_URL') THEN
    PERFORM vault.create_secret(
      -- URL interne réseau Docker : accessible depuis le container supabase_db
      'http://supabase_kong_SunuKaadu:8000',
      'SUPABASE_URL',
      'URL interne de l''instance Supabase (réseau Docker local)'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'SERVICE_ROLE_KEY') THEN
    PERFORM vault.create_secret(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
      'SERVICE_ROLE_KEY',
      'Clé service role locale Supabase (dev uniquement)'
    );
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Planification pg_cron : toutes les minutes
-- ─────────────────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'auto-open-elections',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/auto-schedule-elections',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
