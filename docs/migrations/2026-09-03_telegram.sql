-- ============================================================
-- Casa Nostra - Migrazione "notifiche e assistente Telegram"
-- 3 settembre 2026
-- ------------------------------------------------------------
-- Da eseguire nell'editor SQL di Supabase (o via MCP apply_migration).
-- Aggiunge:
--   1. profiles.telegram_user_id  -> collega un profilo a un account Telegram
--   2. public.telegram_messages   -> memoria della conversazione di gruppo
-- Le stesse definizioni sono replicate nello schema autoritativo
-- docs/casa_nostra_schema.sql (sezione 10).
-- ============================================================

-- 1. Collegamento profilo <-> account Telegram --------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_user_id bigint UNIQUE;

COMMENT ON COLUMN public.profiles.telegram_user_id IS
  'Id numerico dell''account Telegram collegato al profilo. Il webhook lo usa per riconoscere chi scrive nel gruppo; NULL = account non collegato.';


-- 2. Memoria della conversazione Telegram ------------------------------------
-- Il webhook e' stateless: la cronologia dei messaggi scambiati con il bot vive
-- qui, cosi' l'assistente puo' sostenere conversazioni a piu' turni (es. chiedere
-- conferma prima di registrare una spesa). Vengono salvati solo i messaggi che
-- coinvolgono il bot, non le chiacchiere tra i due utenti.

CREATE TABLE IF NOT EXISTS public.telegram_messages (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id      bigint NOT NULL,
  update_id    bigint UNIQUE,
  role         text NOT NULL CHECK (role IN ('user', 'model')),
  sender_name  text,
  content      text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.telegram_messages IS
  'Cronologia dei messaggi scambiati con il bot Telegram, usata come memoria conversazionale dall''assistente IA.';
COMMENT ON COLUMN public.telegram_messages.update_id IS
  'update_id dell''aggiornamento Telegram che ha generato la riga (solo per i messaggi in arrivo). UNIQUE: rende idempotenti i retry del webhook.';
COMMENT ON COLUMN public.telegram_messages.sender_name IS
  'Nome di chi ha scritto il messaggio: nelle chat di gruppo serve all''assistente per capire chi dice "io".';

CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat_created
  ON public.telegram_messages (chat_id, created_at DESC);

-- RLS: la tabella e' scritta e letta dal webhook con la service role key (che
-- bypassa RLS). Le policy servono solo a consentire la lettura dall'app ai due
-- utenti autorizzati, coerentemente con il resto dello schema.
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telegram_messages_select_authorized" ON public.telegram_messages;
CREATE POLICY "telegram_messages_select_authorized"
  ON public.telegram_messages FOR SELECT
  TO authenticated
  USING (public.is_authorized_user());
