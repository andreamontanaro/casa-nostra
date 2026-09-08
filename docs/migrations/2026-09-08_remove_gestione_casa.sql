-- ============================================================
-- Casa Nostra - Rimozione modulo "Gestione casa"
-- ------------------------------------------------------------
-- Rimuove definitivamente faccende, catalogo, gamification e
-- storico associato. Le viste sono eliminate prima delle tabelle;
-- i dati delle faccende non vengono conservati.
-- ============================================================

DROP VIEW IF EXISTS public.v_chore_week_area;
DROP VIEW IF EXISTS public.v_chore_kudos_week;
DROP VIEW IF EXISTS public.v_chore_week;
DROP VIEW IF EXISTS public.v_chore_status;

DROP FUNCTION IF EXISTS public.current_chore_week_start();

DROP TABLE IF EXISTS public.chore_kudos;
DROP TABLE IF EXISTS public.chore_logs;
DROP TABLE IF EXISTS public.chore_templates;

DROP TYPE IF EXISTS public.chore_area;
