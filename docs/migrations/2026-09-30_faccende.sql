-- ============================================================
-- Casa Nostra - Modulo "Faccende domestiche"
-- ------------------------------------------------------------
-- Due bottiglie, una per persona: ogni faccenda riempie una tacca.
-- Tutte le faccende valgono uguale. Chi lavora da casa ha una tacca
-- in piu' dal lunedi' al venerdi', e quella tacca e' un bonus: la
-- sua prima faccenda del giorno non entra nel confronto.
--
-- A differenza del vecchio modulo "Gestione casa" (rimosso con
-- 2026-09-08_remove_gestione_casa.sql) qui un debito c'e', ed e'
-- voluto: chi resta indietro se lo porta ai giorni successivi,
-- senza limite, mentre le bottiglie si svuotano ogni mezzanotte.
-- Nessun legame con i soldi e nessuna notifica.
--
-- Da eseguire nell'editor SQL di Supabase. Replicata nella
-- sezione 14 di docs/casa_nostra_schema.sql.
-- ============================================================

-- ------------------------------------------------------------
-- Chi lavora da casa
-- ------------------------------------------------------------
-- Stesso pattern di higher_income per la regola 60/40: il privilegio
-- sta sul profilo, non su un nome scritto nel codice.

ALTER TABLE public.profiles
  ADD COLUMN works_from_home boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.works_from_home IS
  'True per il partner che lavora da casa: dal lunedi'' al venerdi'' ha una tacca in piu'' nella bottiglia delle faccende, e la sua prima faccenda del giorno e'' un bonus che non entra nel confronto. Al massimo uno dei due profili puo'' avere true.';

CREATE UNIQUE INDEX profiles_only_one_works_from_home
  ON public.profiles ((true))
  WHERE works_from_home = true;


-- ------------------------------------------------------------
-- Regole del giorno
-- ------------------------------------------------------------
-- Il giorno e' quello della casa (Europe/Rome), non quello UTC del
-- server: una faccenda segnata alle 00:30 appartiene al giorno nuovo.

CREATE FUNCTION public.chore_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT (now() AT TIME ZONE 'Europe/Rome')::date;
$$;

COMMENT ON FUNCTION public.chore_today IS
  'Il giorno corrente nel fuso della casa. Le bottiglie si svuotano quando cambia.';

-- 1 se in quel giorno la persona ha la tacca bonus, 0 altrimenti.
-- Il bonus vale solo nei giorni feriali: nel weekend si e' a casa
-- entrambi, e le bottiglie sono uguali.
CREATE FUNCTION public.chore_bonus(p_works_from_home boolean, p_day date)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT CASE WHEN p_works_from_home AND extract(isodow FROM p_day) <= 5 THEN 1 ELSE 0 END;
$$;

COMMENT ON FUNCTION public.chore_bonus IS
  'Tacche bonus di una persona in un giorno: 1 dal lunedi'' al venerdi'' per chi lavora da casa, altrimenti 0. La capienza della bottiglia e'' 5 + questo valore.';


-- ------------------------------------------------------------
-- Faccende fatte
-- ------------------------------------------------------------
-- Una riga = una tacca. Il nome e' testo libero e corto, perche'
-- viene scritto dentro la tacca. Niente catalogo: i suggerimenti
-- nell'app sono le faccende gia' segnate.

CREATE TABLE public.chore_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
  done_by     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  done_on     date NOT NULL DEFAULT public.chore_today(),
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chore_entries IS
  'Faccende domestiche fatte: una riga per tacca. done_by e'' chi l''ha fatta, created_by chi l''ha segnata (si puo'' segnare per l''altro).';
COMMENT ON COLUMN public.chore_entries.done_on IS
  'Il giorno (fuso Europe/Rome) in cui la faccenda e'' stata fatta. Si puo'' retrodatare, non si puo'' mettere nel futuro.';

CREATE INDEX idx_chore_entries_day
  ON public.chore_entries (done_on DESC, done_by);


-- La bottiglia piena e' un limite vero, non solo un bottone
-- disattivato: 5 tacche, 6 per chi lavora da casa nei giorni feriali.
-- Il lock consultivo serializza due inserimenti contemporanei sulla
-- stessa bottiglia, altrimenti entrambi vedrebbero l'ultima tacca
-- libera.
CREATE FUNCTION public.chore_entries_check_bottle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_capacity int;
  v_used     int;
BEGIN
  IF NEW.done_on > public.chore_today() THEN
    RAISE EXCEPTION 'chore_future_date' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('chore:' || NEW.done_by::text || ':' || NEW.done_on::text));

  SELECT 5 + public.chore_bonus(p.works_from_home, NEW.done_on)
    INTO v_capacity
    FROM public.profiles p
   WHERE p.id = NEW.done_by;

  SELECT count(*)::int
    INTO v_used
    FROM public.chore_entries e
   WHERE e.done_by = NEW.done_by
     AND e.done_on = NEW.done_on
     AND e.id <> NEW.id;

  IF v_used >= v_capacity THEN
    RAISE EXCEPTION 'chore_bottle_full' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chore_entries_check_bottle
  BEFORE INSERT OR UPDATE OF done_by, done_on ON public.chore_entries
  FOR EACH ROW EXECUTE FUNCTION public.chore_entries_check_bottle();


-- ------------------------------------------------------------
-- v_chore_balance: la parita' delle faccende
-- ------------------------------------------------------------
-- Il "livello" di una persona in un giorno e' quante faccende ha
-- fatto meno la tacca bonus, mai sotto zero: con 0 o 1 faccenda chi
-- lavora da casa e' comunque al livello 0. Le due bottiglie sono pari
-- quando i livelli coincidono.
--
-- net_position e' la somma, su tutti i giorni, di (mio livello -
-- livello dell'altro). > 0 => sono avanti; < 0 => sono indietro di
-- quel numero di livelli. Come per v_user_open_balance, le due righe
-- hanno valori opposti e l'app non ricalcola niente.
--
-- tasks_to_parity sono le faccende che servono davvero per tornare
-- pari: i livelli mancanti, piu' uno se oggi la tacca bonus e' ancora
-- vuota (la prima faccenda del giorno non alza il livello).

CREATE VIEW public.v_chore_balance
WITH (security_invoker = on) AS
WITH days AS (
  SELECT DISTINCT done_on AS day FROM public.chore_entries
  UNION
  SELECT public.chore_today()
),
counts AS (
  SELECT done_by, done_on, count(*)::int AS n
  FROM public.chore_entries
  GROUP BY done_by, done_on
),
levels AS (
  SELECT
    p.id AS user_id,
    p.display_name,
    p.works_from_home,
    d.day,
    COALESCE(c.n, 0) AS n,
    public.chore_bonus(p.works_from_home, d.day) AS bonus,
    greatest(COALESCE(c.n, 0) - public.chore_bonus(p.works_from_home, d.day), 0) AS level
  FROM public.profiles p
  CROSS JOIN days d
  LEFT JOIN counts c ON c.done_by = p.id AND c.done_on = d.day
),
diffs AS (
  SELECT
    l.*,
    -- mio livello - livello dell'altro, con due sole righe per giorno
    2 * l.level - sum(l.level) OVER (PARTITION BY l.day) AS diff
  FROM levels l
),
agg AS (
  SELECT
    user_id,
    display_name,
    works_from_home,
    COALESCE(sum(n)     FILTER (WHERE day = public.chore_today()), 0)::int AS today_count,
    COALESCE(max(bonus) FILTER (WHERE day = public.chore_today()), 0)::int AS today_bonus,
    COALESCE(sum(diff)  FILTER (WHERE day = public.chore_today()), 0)::int AS net_today,
    COALESCE(sum(diff)  FILTER (WHERE day < public.chore_today()), 0)::int AS net_before_today,
    COALESCE(sum(diff), 0)::int AS net_position
  FROM diffs
  GROUP BY user_id, display_name, works_from_home
)
SELECT
  user_id,
  display_name,
  works_from_home,
  today_count,
  today_bonus,
  5 + today_bonus AS today_capacity,
  net_today,
  net_before_today,
  net_position,
  CASE
    WHEN net_position < 0
      THEN -net_position + CASE WHEN today_bonus = 1 AND today_count = 0 THEN 1 ELSE 0 END
    ELSE 0
  END AS tasks_to_parity
FROM agg;

COMMENT ON VIEW public.v_chore_balance IS
  'Parita'' delle faccende per persona. net_position > 0 => avanti, < 0 => indietro di quei livelli (arretrato compreso). tasks_to_parity = faccende da fare per tornare pari, contando la tacca bonus ancora vuota.';


-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
-- Entrambi vedono tutto e possono segnare una faccenda anche per
-- l'altro. Si cancella solo cio' che si e' fatto o si e' segnato:
-- una riga dice "questa cosa l'ho fatta io", e l'altro non deve
-- poterla togliere. Niente UPDATE: per correggere si elimina e si
-- rifa', che e' anche l'unico gesto previsto dall'app.

ALTER TABLE public.chore_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chore_entries_select_authorized"
  ON public.chore_entries FOR SELECT
  TO authenticated
  USING (public.is_authorized_user());

CREATE POLICY "chore_entries_insert_authorized"
  ON public.chore_entries FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user() AND created_by = auth.uid());

CREATE POLICY "chore_entries_delete_own"
  ON public.chore_entries FOR DELETE
  TO authenticated
  USING (public.is_authorized_user() AND (done_by = auth.uid() OR created_by = auth.uid()));

REVOKE ALL ON FUNCTION public.chore_entries_check_bottle() FROM public, anon;


-- ------------------------------------------------------------
-- Dati: chi lavora da casa
-- ------------------------------------------------------------
-- Come il bootstrap dei profili (sezione 9), va fatto a mano con
-- l'id vero:
-- UPDATE public.profiles SET works_from_home = true WHERE id = '<uuid>';
