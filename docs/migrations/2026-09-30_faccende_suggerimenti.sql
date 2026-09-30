-- ============================================================
-- Casa Nostra - Faccende: suggerimenti all'altra persona
-- ------------------------------------------------------------
-- Fede avvia la lavatrice e suggerisce ad Andrea "Stendo i panni".
-- Il suggerimento compare sbiadito nella prima tacca libera della
-- bottiglia di Andrea; Andrea lo conferma (diventa una faccenda) o
-- lo scarta, oppure fa altro e il suggerimento sale alla tacca dopo.
--
-- Un suggerimento non e' una faccenda: non conta per la parita'
-- finche' non viene confermato, e scade a mezzanotte insieme alla
-- bottiglia. Nessuna notifica: si vede aprendo l'app.
--
-- Da eseguire nell'editor SQL di Supabase. Replicata nella
-- sezione 14 di docs/casa_nostra_schema.sql.
-- ============================================================

CREATE TABLE public.chore_hints (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
  for_user    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_user   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hint_on     date NOT NULL DEFAULT public.chore_today(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chore_hints_not_to_self CHECK (for_user <> from_user)
);

COMMENT ON TABLE public.chore_hints IS
  'Faccende suggerite all''altra persona. Valgono solo il giorno hint_on (scadono a mezzanotte) e non contano per la parita'' finche'' non vengono confermate con accept_chore_hint.';

-- Lo stesso suggerimento due volte nello stesso giorno e' un doppio tocco.
CREATE UNIQUE INDEX chore_hints_unique_per_day
  ON public.chore_hints (for_user, hint_on, lower(trim(name)));


-- Un suggerimento occupa una tacca libera: faccende + suggerimenti
-- non superano la capienza della bottiglia di oggi. Si suggerisce
-- solo per oggi. Chi inserisce fa anche pulizia dei suggerimenti
-- scaduti, cosi' la tabella non cresce.
CREATE FUNCTION public.chore_hints_check_bottle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_capacity int;
  v_used     int;
BEGIN
  IF NEW.hint_on <> public.chore_today() THEN
    RAISE EXCEPTION 'chore_hint_not_today' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.chore_hints WHERE hint_on < public.chore_today();

  PERFORM pg_advisory_xact_lock(hashtext('chore:' || NEW.for_user::text || ':' || NEW.hint_on::text));

  SELECT 5 + public.chore_bonus(p.works_from_home, NEW.hint_on)
    INTO v_capacity
    FROM public.profiles p
   WHERE p.id = NEW.for_user;

  SELECT (SELECT count(*) FROM public.chore_entries e
           WHERE e.done_by = NEW.for_user AND e.done_on = NEW.hint_on)
       + (SELECT count(*) FROM public.chore_hints h
           WHERE h.for_user = NEW.for_user AND h.hint_on = NEW.hint_on AND h.id <> NEW.id)
    INTO v_used;

  IF v_used >= v_capacity THEN
    RAISE EXCEPTION 'chore_bottle_full' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chore_hints_check_bottle
  BEFORE INSERT ON public.chore_hints
  FOR EACH ROW EXECUTE FUNCTION public.chore_hints_check_bottle();

REVOKE ALL ON FUNCTION public.chore_hints_check_bottle() FROM public, anon;


-- ------------------------------------------------------------
-- accept_chore_hint: il suggerimento diventa una faccenda
-- ------------------------------------------------------------
-- In una transazione: toglie il suggerimento e segna la faccenda a
-- nome di chi lo riceve. Se la bottiglia e' piena il trigger di
-- chore_entries rifiuta l'inserimento e il suggerimento resta dov'era.
-- Lo conferma solo chi lo ha ricevuto, e solo nel suo giorno.

CREATE FUNCTION public.accept_chore_hint(p_hint_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name     text;
  v_entry_id uuid;
BEGIN
  DELETE FROM public.chore_hints
   WHERE id = p_hint_id
     AND for_user = auth.uid()
     AND hint_on = public.chore_today()
  RETURNING name INTO v_name;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'chore_hint_not_found' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.chore_entries (name, done_by, created_by)
  VALUES (v_name, auth.uid(), auth.uid())
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

COMMENT ON FUNCTION public.accept_chore_hint IS
  'Conferma un suggerimento ricevuto: lo toglie e segna la faccenda per oggi, in un''unica transazione. Ritorna l''id della faccenda.';

REVOKE ALL ON FUNCTION public.accept_chore_hint FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_chore_hint TO authenticated;


-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
-- Entrambi li vedono. Si suggerisce solo a nome proprio. Lo toglie
-- chi lo ha mandato (ritira) o chi lo ha ricevuto (scarta o conferma).

ALTER TABLE public.chore_hints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chore_hints_select_authorized"
  ON public.chore_hints FOR SELECT
  TO authenticated
  USING (public.is_authorized_user());

CREATE POLICY "chore_hints_insert_own"
  ON public.chore_hints FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user() AND from_user = auth.uid());

CREATE POLICY "chore_hints_delete_involved"
  ON public.chore_hints FOR DELETE
  TO authenticated
  USING (public.is_authorized_user() AND (from_user = auth.uid() OR for_user = auth.uid()));
