-- ============================================================
-- Casa Nostra - Faccende: togliere un nome dai "Recenti"
-- ------------------------------------------------------------
-- La scheda "Recenti" del pannello elenca i nomi delle ultime
-- faccende segnate. Toglierne uno NON cancella le faccende (le
-- bottiglie e l'arretrato non cambiano): lo nasconde e basta.
-- Se quella faccenda viene segnata di nuovo dopo, il nome torna.
--
-- Da eseguire nell'editor SQL di Supabase. Replicata nella
-- sezione 14 di docs/casa_nostra_schema.sql.
-- ============================================================

CREATE TABLE public.chore_recent_dismissals (
  -- lower(trim(name)) della faccenda: "Lavo i piatti" e "lavo i piatti"
  -- sono lo stesso recente.
  name_key      text PRIMARY KEY CHECK (length(name_key) BETWEEN 1 AND 40),
  dismissed_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  dismissed_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chore_recent_dismissals IS
  'Nomi tolti dalla scheda "Recenti" delle faccende. Un nome resta nascosto finche'' non viene segnata una faccenda con quel nome dopo dismissed_at. Non tocca chore_entries.';

-- Di casa, come le azioni: entrambi tolgono e rimettono.
ALTER TABLE public.chore_recent_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chore_recent_dismissals_all_authorized"
  ON public.chore_recent_dismissals FOR ALL
  TO authenticated
  USING (public.is_authorized_user())
  WITH CHECK (public.is_authorized_user() AND dismissed_by = auth.uid());
