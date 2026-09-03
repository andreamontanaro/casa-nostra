-- ============================================================
-- Casa Nostra - Modulo "Gestione casa" (fase 1)
-- ------------------------------------------------------------
-- Faccende domestiche condivise: catalogo modificabile, registro
-- dei completamenti, viste di stato e di aggregazione settimanale.
-- La fase 1 registra gli XP ma non li mostra in interfaccia.
-- Progettazione completa: docs/design-modulo-gestione-casa.md
-- ============================================================

-- ------------------------------------------------------------
-- Enum delle aree di casa
-- ------------------------------------------------------------
CREATE TYPE chore_area AS ENUM (
  'cucina',
  'bagno',
  'pulizie',
  'spazzatura',
  'bucato',
  'spesa',
  'manutenzione',
  'altro'
);

-- ------------------------------------------------------------
-- Catalogo delle faccende
-- ------------------------------------------------------------
CREATE TABLE public.chore_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL CHECK (length(trim(name)) > 0),
  area         chore_area NOT NULL,
  effort_xp    int NOT NULL CHECK (effort_xp BETWEEN 1 AND 100),
  cadence_days int CHECK (cadence_days > 0),
  active       boolean NOT NULL DEFAULT true,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chore_templates IS
  'Catalogo delle faccende ricorrenti. Interamente modificabile dai due utenti: il seed iniziale non e'' cablato nel codice.';
COMMENT ON COLUMN public.chore_templates.cadence_days IS
  'Ogni quanti giorni la casa si aspetta la faccenda. NULL = "gesto": registrabile ma mai atteso, non compare in "Da fare" e non ha stato di ritardo.';
COMMENT ON COLUMN public.chore_templates.active IS
  'Eliminazione logica. Una voce disattivata sparisce dalle liste e dai conti futuri ma lo storico resta intatto.';
COMMENT ON COLUMN public.chore_templates.effort_xp IS
  'Valore in XP, tarato sui minuti di lavoro. Ritoccarlo non riscrive lo storico: chore_logs.xp e'' uno snapshot.';

CREATE INDEX idx_chore_templates_active
  ON public.chore_templates (active, area, sort_order);

-- ------------------------------------------------------------
-- Registro dei completamenti
-- ------------------------------------------------------------
CREATE TABLE public.chore_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid REFERENCES public.chore_templates(id) ON DELETE SET NULL,
  title        text NOT NULL CHECK (length(trim(title)) > 0),
  area         chore_area NOT NULL,
  xp           int NOT NULL CHECK (xp >= 0),
  done_by      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  done_at      timestamptz NOT NULL DEFAULT now(),
  note         text,
  created_by   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chore_logs IS
  'Registro delle faccende completate. title/area/xp sono snapshot del catalogo al momento della registrazione, cosi'' ritarare il catalogo non riscrive la storia.';
COMMENT ON COLUMN public.chore_logs.template_id IS
  'NULL per una faccenda fuori catalogo (una-tantum) o per una voce di catalogo cancellata fisicamente.';
COMMENT ON COLUMN public.chore_logs.done_by IS
  'Chi ha fatto la faccenda. Puo'' differire da created_by: registrare per conto dell''altro e'' permesso.';
COMMENT ON COLUMN public.chore_logs.done_at IS
  'Quando e'' stata fatta. Retrodatabile: "l''ho fatto ieri e mi sono dimenticato di segnarlo".';

CREATE INDEX idx_chore_logs_done_at   ON public.chore_logs (done_at DESC);
CREATE INDEX idx_chore_logs_template  ON public.chore_logs (template_id, done_at DESC);
CREATE INDEX idx_chore_logs_done_by   ON public.chore_logs (done_by, done_at DESC);

-- ------------------------------------------------------------
-- Trigger updated_at (riusa public.set_updated_at gia' presente)
-- ------------------------------------------------------------
CREATE TRIGGER trg_chore_templates_updated_at
  BEFORE UPDATE ON public.chore_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_chore_logs_updated_at
  BEFORE UPDATE ON public.chore_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Viste
-- ------------------------------------------------------------
-- Stato di ogni faccenda attiva: ultimo completamento e scadenza derivata.
-- Le ricorrenze NON sono materializzate: nessun job, nessuna riga fantasma.
-- Il fuso e' fissato a Europe/Rome: "oggi" e "questa settimana" sono quelli
-- dei due conviventi, non quelli di UTC. Per lo stesso motivo il "oggi" di
-- riferimento e' (now() AT TIME ZONE 'Europe/Rome')::date e non current_date,
-- che segue il fuso della sessione (UTC su Supabase) e a mezzanotte darebbe
-- un giorno di scarto.
CREATE VIEW public.v_chore_status
WITH (security_invoker = on) AS
SELECT
  t.id,
  t.name,
  t.area,
  t.effort_xp,
  t.cadence_days,
  t.sort_order,
  l.done_at                        AS last_done_at,
  l.done_by                        AS last_done_by,
  p.display_name                   AS last_done_by_name,
  CASE
    WHEN l.done_at IS NULL THEN NULL
    ELSE ((now() AT TIME ZONE 'Europe/Rome')::date - (l.done_at AT TIME ZONE 'Europe/Rome')::date)
  END::int                         AS days_since,
  CASE
    WHEN t.cadence_days IS NULL THEN NULL
    WHEN l.done_at IS NULL THEN 0
    ELSE t.cadence_days - ((now() AT TIME ZONE 'Europe/Rome')::date - (l.done_at AT TIME ZONE 'Europe/Rome')::date)
  END::int                         AS due_in_days
FROM public.chore_templates t
LEFT JOIN LATERAL (
  SELECT cl.done_at, cl.done_by
  FROM public.chore_logs cl
  WHERE cl.template_id = t.id
  ORDER BY cl.done_at DESC
  LIMIT 1
) l ON true
LEFT JOIN public.profiles p ON p.id = l.done_by
WHERE t.active;

COMMENT ON VIEW public.v_chore_status IS
  'Stato corrente di ogni faccenda attiva. due_in_days negativo = in attesa da piu'' giorni della cadenza; 0 alla scadenza o se mai registrata; NULL per i gesti (cadenza libera).';

-- Aggregato settimanale per utente. In fase 1 alimenta solo l'analisi dei dati
-- (gli XP sono registrati ma non mostrati); dalla fase 2 obiettivo ed equilibrio.
CREATE VIEW public.v_chore_week
WITH (security_invoker = on) AS
SELECT
  date_trunc('week', (l.done_at AT TIME ZONE 'Europe/Rome'))::date AS week_start,
  l.done_by                    AS user_id,
  p.display_name,
  count(*)::int                AS chore_count,
  sum(l.xp)::int               AS xp
FROM public.chore_logs l
JOIN public.profiles p ON p.id = l.done_by
GROUP BY 1, 2, 3;

COMMENT ON VIEW public.v_chore_week IS
  'XP e numero di faccende per utente e per settimana ISO (fuso Europe/Rome).';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.chore_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chore_logs      ENABLE ROW LEVEL SECURITY;

-- Catalogo: entrambi gli utenti autorizzati possono gestirlo per intero.
CREATE POLICY "chore_templates_all_authorized"
  ON public.chore_templates FOR ALL
  TO authenticated
  USING (public.is_authorized_user())
  WITH CHECK (public.is_authorized_user());

-- Registro: entrambi leggono tutto.
CREATE POLICY "chore_logs_select_authorized"
  ON public.chore_logs FOR SELECT
  TO authenticated
  USING (public.is_authorized_user());

-- Chiunque dei due puo' registrare, anche per conto dell'altro.
CREATE POLICY "chore_logs_insert_authorized"
  ON public.chore_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user() AND created_by = auth.uid());

-- Ma si corregge o si cancella solo cio' che si e' fatto o che si e' scritto:
-- una riga di chore_logs dice "questa cosa l'ho fatta io", e poter cancellare
-- con un tap il contributo registrato dall'altro non deve essere possibile.
-- E' l'unico punto in cui questo modulo e' piu' restrittivo del modulo spese.
CREATE POLICY "chore_logs_update_own"
  ON public.chore_logs FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user() AND (done_by = auth.uid() OR created_by = auth.uid()))
  WITH CHECK (public.is_authorized_user() AND (done_by = auth.uid() OR created_by = auth.uid()));

CREATE POLICY "chore_logs_delete_own"
  ON public.chore_logs FOR DELETE
  TO authenticated
  USING (public.is_authorized_user() AND (done_by = auth.uid() OR created_by = auth.uid()));

-- ------------------------------------------------------------
-- Catalogo iniziale
-- ------------------------------------------------------------
-- Tarato sulla casa reale: niente lavastoviglie, stiro, piante, balcone,
-- giardino o animali; lavatrice settimanale; lenzuola ogni due settimane.
-- E' solo il contenuto iniziale della tabella: tutto e' modificabile dall'app.
INSERT INTO public.chore_templates (name, area, effort_xp, cadence_days, sort_order) VALUES
  ('Cucinare la cena',                    'cucina',     20, 1,    10),
  ('Lavare i piatti a mano',              'cucina',     20, 1,    20),
  ('Sparecchiare e riordinare la cucina', 'cucina',      8, 1,    30),
  ('Pulire il piano cottura',             'cucina',     10, 3,    40),
  ('Pulire il frigo / buttare l''avanzato','cucina',     10, 14,   50),
  ('Preparare il pranzo all''altro',      'cucina',      8, NULL, 60),
  ('Fare la spesa',                       'spesa',      30, 7,    70),
  ('Giro di riordino (mini task)',        'pulizie',     5, 1,    80),
  ('Riordinare il soggiorno',             'pulizie',    10, 3,    90),
  ('Aspirare / spazzare',                 'pulizie',    20, 4,   100),
  ('Lavare i pavimenti',                  'pulizie',    25, 7,   110),
  ('Spolverare',                          'pulizie',    15, 14,  120),
  ('Pulire il bagno a fondo',             'bagno',      25, 7,   130),
  ('Lavandino e specchio',                'bagno',       8, 3,   140),
  ('Fare la lavatrice',                   'bucato',     10, 7,   150),
  ('Stendere il bucato',                  'bucato',     15, 7,   160),
  ('Ritirare e piegare',                  'bucato',     20, 7,   170),
  ('Cambiare le lenzuola',                'bucato',     15, 14,  180),
  ('Cambiare gli asciugamani',            'bucato',      5, 7,   190),
  ('Portare fuori la spazzatura',         'spazzatura',  5, 2,   200),
  ('Vetro / plastica / carta',            'spazzatura',  8, 7,   210),
  ('Rifare il letto',                     'altro',       3, 1,   220);
