-- ============================================================
-- Casa Nostra - Modulo "Gestione casa" (fase 2)
-- ------------------------------------------------------------
-- Kudos, funzione di supporto per il calcolo dell'obiettivo
-- settimanale e della striscia. Nessun saldo, nessun conguaglio:
-- resta valido per l'intero modulo (fase 1 e fase 2).
-- Progettazione: docs/design-modulo-gestione-casa.md
-- ============================================================

-- ------------------------------------------------------------
-- Kudos: una reazione per (log, chi la lascia). Accredita XP alla
-- casa, non a chi la riceve né a chi la dà — vedi lib/chores/config.ts.
-- ------------------------------------------------------------
CREATE TABLE public.chore_kudos (
  log_id       uuid NOT NULL REFERENCES public.chore_logs(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji        text NOT NULL DEFAULT '❤️',
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (log_id, from_user_id)
);

COMMENT ON TABLE public.chore_kudos IS
  'Reazione di un utente su una faccenda completata dall''altro. Al massimo una per utente per log (PK composita): cambiare emoji aggiorna la riga, non la duplica. Accredita XP all''obiettivo settimanale della casa, non a chi la riceve né a chi la dà.';

CREATE INDEX idx_chore_kudos_log ON public.chore_kudos (log_id);

ALTER TABLE public.chore_kudos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chore_kudos_select_authorized"
  ON public.chore_kudos FOR SELECT
  TO authenticated
  USING (public.is_authorized_user());

-- Non si può dare un kudos alla propria faccenda: la sottoquery su
-- chore_logs.done_by è il vincolo, non un controllo lato client.
CREATE POLICY "chore_kudos_insert_other"
  ON public.chore_kudos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_authorized_user()
    AND from_user_id = auth.uid()
    AND (SELECT done_by FROM public.chore_logs WHERE id = log_id) <> auth.uid()
  );

CREATE POLICY "chore_kudos_update_own"
  ON public.chore_kudos FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user() AND from_user_id = auth.uid())
  WITH CHECK (
    public.is_authorized_user()
    AND from_user_id = auth.uid()
    AND (SELECT done_by FROM public.chore_logs WHERE id = log_id) <> auth.uid()
  );

CREATE POLICY "chore_kudos_delete_own"
  ON public.chore_kudos FOR DELETE
  TO authenticated
  USING (public.is_authorized_user() AND from_user_id = auth.uid());

-- ------------------------------------------------------------
-- Kudos per settimana (fuso Europe/Rome), per il conteggio degli XP
-- di casa nell'obiettivo settimanale.
-- ------------------------------------------------------------
CREATE VIEW public.v_chore_kudos_week
WITH (security_invoker = on) AS
SELECT
  date_trunc('week', (created_at AT TIME ZONE 'Europe/Rome'))::date AS week_start,
  count(*)::int AS kudos_count
FROM public.chore_kudos
GROUP BY 1;

COMMENT ON VIEW public.v_chore_kudos_week IS
  'Numero di kudos per settimana ISO (fuso Europe/Rome). Ogni kudos vale KUDOS_XP (lib/chores/config.ts) sul totale settimanale di casa, ma non è attribuito a nessuno dei due utenti.';

-- ------------------------------------------------------------
-- Inizio della settimana corrente, stesso fuso e stessa semantica
-- delle viste sopra. Evita di reimplementare date_trunc('week', ...)
-- lato client con tutte le insidie dei fusi orari.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_chore_week_start()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT date_trunc('week', (now() AT TIME ZONE 'Europe/Rome'))::date;
$$;

REVOKE ALL ON FUNCTION public.current_chore_week_start() FROM public;
GRANT EXECUTE ON FUNCTION public.current_chore_week_start() TO authenticated;
