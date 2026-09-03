-- ============================================================
-- Casa Nostra - Schema DB per Supabase
-- MVP v1.0 - Aprile 2026
-- ------------------------------------------------------------
-- Da eseguire nell'editor SQL di Supabase.
-- Assume Postgres 15+ con estensioni standard di Supabase
-- (pgcrypto per gen_random_uuid, auth schema gia' presente).
-- ============================================================


-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE expense_category AS ENUM (
  'affitto',
  'bolletta',
  'spesa_alimentare',
  'abbonamento',
  'manutenzione',
  'viaggi',
  'altro'
);

CREATE TYPE split_rule AS ENUM (
  'fifty_fifty',   -- 50/50: usata per l'affitto
  'sixty_forty',   -- 60/40: il profilo con higher_income=true paga il 60%
  'custom'         -- importo fisso: custom_other_share indica la quota dell'altra persona
);


-- ============================================================
-- 2. TABELLA profiles (1:1 con auth.users)
-- ============================================================

CREATE TABLE public.profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     text NOT NULL CHECK (length(trim(display_name)) > 0),
  higher_income    boolean NOT NULL DEFAULT false,
  telegram_user_id bigint UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'Estende auth.users con i dati applicativi. Esattamente due righe previste.';

COMMENT ON COLUMN public.profiles.higher_income IS
  'True per il partner con reddito maggiore (paga 60% nella regola 60/40). Al massimo uno dei due profili puo'' avere true.';

COMMENT ON COLUMN public.profiles.telegram_user_id IS
  'Id numerico dell''account Telegram collegato al profilo (vedi sezione 10). NULL = account non collegato.';

-- Vincolo: al massimo un profilo con higher_income = true
CREATE UNIQUE INDEX profiles_only_one_higher_income
  ON public.profiles ((true))
  WHERE higher_income = true;


-- ============================================================
-- 3. TABELLA settlements (conguagli)
-- ============================================================

CREATE TABLE public.settlements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settled_at     timestamptz NOT NULL DEFAULT now(),
  amount         numeric(10,2) NOT NULL CHECK (amount > 0),
  from_user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  to_user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  notes          text,
  created_by     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (from_user_id <> to_user_id)
);

CREATE INDEX idx_settlements_settled_at ON public.settlements(settled_at DESC);

COMMENT ON TABLE public.settlements IS
  'Registro dei conguagli. Ogni riga rappresenta un bonifico da from_user a to_user che chiude un insieme di spese.';


-- ============================================================
-- 4. TABELLA expenses (spese)
-- ============================================================

CREATE TABLE public.expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount         numeric(10,2) NOT NULL CHECK (amount > 0),
  description    text NOT NULL CHECK (length(trim(description)) > 0),
  category       expense_category NOT NULL,
  split_rule          split_rule NOT NULL,
  custom_other_share  numeric(10,2)
    CONSTRAINT expenses_custom_other_share_positive
      CHECK (custom_other_share IS NULL OR custom_other_share > 0),
  CONSTRAINT expenses_custom_share_consistency CHECK (
    (split_rule = 'custom' AND custom_other_share IS NOT NULL) OR
    (split_rule <> 'custom' AND custom_other_share IS NULL)
  ),
  paid_by        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  expense_date   date NOT NULL DEFAULT current_date,
  settlement_id  uuid REFERENCES public.settlements(id) ON DELETE RESTRICT,
  created_by     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.expenses IS
  'Spese condivise. settlement_id IS NULL => spesa aperta. settlement_id valorizzato => spesa saldata.';

-- Indici per le query piu' frequenti
CREATE INDEX idx_expenses_expense_date   ON public.expenses (expense_date DESC);
CREATE INDEX idx_expenses_category       ON public.expenses (category);
CREATE INDEX idx_expenses_paid_by        ON public.expenses (paid_by);
CREATE INDEX idx_expenses_settlement_id  ON public.expenses (settlement_id);
-- Indice parziale per le spese aperte (quelle consultate piu' spesso)
CREATE INDEX idx_expenses_open
  ON public.expenses (expense_date DESC)
  WHERE settlement_id IS NULL;


-- ============================================================
-- 4b. TABELLA expense_attachments (allegati delle spese)
-- ============================================================
-- Scontrini, ricevute e note collegati a una spesa (1-a-molti).
-- I file risiedono nel bucket privato Storage 'expense-attachments';
-- storage_path e' la chiave nel bucket (formato: {expense_id}/{uuid}.{ext}).

CREATE TABLE public.expense_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id   uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  file_name    text NOT NULL,
  mime_type    text NOT NULL,
  size_bytes   bigint NOT NULL CHECK (size_bytes > 0),
  uploaded_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.expense_attachments IS
  'Allegati (scontrini, ricevute, note) collegati a una spesa. ON DELETE CASCADE rimuove i metadati con la spesa; i file su Storage vanno rimossi a parte dall''applicazione.';

CREATE INDEX idx_expense_attachments_expense_id
  ON public.expense_attachments (expense_id);


-- ============================================================
-- 5. TRIGGER per aggiornamento di updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 6. VISTE per il calcolo del saldo
-- ============================================================

-- Per ogni spesa e ogni utente, la quota dovuta secondo la regola applicata.
CREATE OR REPLACE VIEW public.v_expense_shares AS
SELECT
  e.id            AS expense_id,
  e.amount        AS expense_amount,
  e.paid_by,
  e.settlement_id,
  e.expense_date,
  p.id            AS user_id,
  CASE
    WHEN e.split_rule = 'fifty_fifty' THEN e.amount * 0.5
    WHEN e.split_rule = 'sixty_forty' AND p.higher_income THEN e.amount * 0.6
    WHEN e.split_rule = 'sixty_forty' AND NOT p.higher_income THEN e.amount * 0.4
    WHEN e.split_rule = 'custom' AND p.id <> e.paid_by        THEN e.custom_other_share
    WHEN e.split_rule = 'custom' AND p.id  = e.paid_by        THEN e.amount - e.custom_other_share
  END::numeric(10,2) AS user_share
FROM public.expenses e
CROSS JOIN public.profiles p;

COMMENT ON VIEW public.v_expense_shares IS
  'Quota dovuta da ciascun utente per ciascuna spesa, in base alla regola di divisione.';


-- Saldo per utente, calcolato solo sulle spese aperte.
-- net_position > 0  => l''utente ha anticipato piu' di quanto dovuto; l''altro gli deve soldi.
-- net_position < 0  => l''utente deve soldi all''altro.
CREATE OR REPLACE VIEW public.v_user_open_balance AS
WITH shares AS (
  SELECT
    s.user_id,
    SUM(CASE WHEN s.paid_by = s.user_id THEN s.expense_amount ELSE 0 END) AS total_anticipated,
    SUM(s.user_share) AS total_owed
  FROM public.v_expense_shares s
  WHERE s.settlement_id IS NULL
  GROUP BY s.user_id
)
SELECT
  p.id           AS user_id,
  p.display_name,
  p.higher_income,
  COALESCE(s.total_anticipated, 0)::numeric(10,2)           AS total_anticipated,
  COALESCE(s.total_owed,         0)::numeric(10,2)          AS total_owed,
  (COALESCE(s.total_anticipated, 0) - COALESCE(s.total_owed, 0))::numeric(10,2) AS net_position
FROM public.profiles p
LEFT JOIN shares s ON s.user_id = p.id;

COMMENT ON VIEW public.v_user_open_balance IS
  'Saldo corrente per utente sulle spese non ancora saldate. net_position e'' la differenza tra anticipato e dovuto.';


-- ============================================================
-- 7. RLS - Row Level Security
-- ============================================================

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- Helper: true se l'utente loggato ha un profilo (cioe' e' uno dei due autorizzati).
CREATE OR REPLACE FUNCTION public.is_authorized_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid());
$$;

-- profiles: entrambi gli utenti autorizzati possono leggere tutti i profili,
-- ma ogni utente puo' aggiornare solo il proprio.
CREATE POLICY "profiles_select_authorized"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_authorized_user());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Nessuna policy di INSERT/DELETE su profiles: i due profili vengono creati
-- manualmente dall'amministratore (vedi sezione 9).

-- expenses: accesso completo per i due utenti autorizzati.
CREATE POLICY "expenses_all_authorized"
  ON public.expenses FOR ALL
  TO authenticated
  USING (public.is_authorized_user())
  WITH CHECK (public.is_authorized_user());

-- settlements: accesso completo per i due utenti autorizzati.
CREATE POLICY "settlements_all_authorized"
  ON public.settlements FOR ALL
  TO authenticated
  USING (public.is_authorized_user())
  WITH CHECK (public.is_authorized_user());

-- expense_attachments: accesso completo per i due utenti autorizzati.
ALTER TABLE public.expense_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_attachments_all_authorized"
  ON public.expense_attachments FOR ALL
  TO authenticated
  USING (public.is_authorized_user())
  WITH CHECK (public.is_authorized_user());

-- ------------------------------------------------------------
-- Storage: bucket privato per gli allegati e relative policy.
-- (Eseguito anche dalla migration; replicato qui per completezza.)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-attachments', 'expense-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ea_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'expense-attachments' AND public.is_authorized_user());
CREATE POLICY "ea_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-attachments' AND public.is_authorized_user());
CREATE POLICY "ea_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'expense-attachments' AND public.is_authorized_user())
  WITH CHECK (bucket_id = 'expense-attachments' AND public.is_authorized_user());
CREATE POLICY "ea_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'expense-attachments' AND public.is_authorized_user());


-- ============================================================
-- 8. FUNZIONE register_settlement (conguaglio transazionale)
-- ============================================================

-- Calcola il saldo netto corrente, crea una riga in settlements
-- e marca come saldate le spese aperte, in un'unica transazione.
--   p_notes        : nota opzionale del conguaglio.
--   p_expense_ids  : se NULL, conguaglia tutte le spese aperte (comportamento
--                    storico). Se array, conguaglia solo quel subset.
-- La firma vecchia (solo p_notes) viene rimossa per evitare overload ambigui.
DROP FUNCTION IF EXISTS public.register_settlement(text);

CREATE OR REPLACE FUNCTION public.register_settlement(
  p_notes text DEFAULT NULL,
  p_expense_ids uuid[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_other_user_id  uuid;
  v_net            numeric(10,2);
  v_from           uuid;
  v_to             uuid;
  v_settlement_id  uuid;
  v_open_count     int;
BEGIN
  IF NOT public.is_authorized_user() THEN
    RAISE EXCEPTION 'Utente non autorizzato';
  END IF;

  SELECT id INTO v_other_user_id
  FROM public.profiles
  WHERE id <> v_user_id
  LIMIT 1;

  IF v_other_user_id IS NULL THEN
    RAISE EXCEPTION 'Secondo profilo non trovato';
  END IF;

  IF p_expense_ids IS NOT NULL THEN
    IF array_length(p_expense_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'Selezione vuota';
    END IF;

    SELECT count(*) INTO v_open_count
    FROM public.expenses
    WHERE id = ANY(p_expense_ids)
      AND settlement_id IS NULL;

    IF v_open_count <> array_length(p_expense_ids, 1) THEN
      RAISE EXCEPTION 'Alcune spese selezionate non sono piu'' aperte';
    END IF;

    SELECT COALESCE(SUM(CASE WHEN s.paid_by = v_user_id THEN s.expense_amount ELSE 0 END), 0)
         - COALESCE(SUM(s.user_share), 0)
    INTO v_net
    FROM public.v_expense_shares s
    WHERE s.expense_id = ANY(p_expense_ids)
      AND s.user_id = v_user_id;
  ELSE
    SELECT net_position INTO v_net
    FROM public.v_user_open_balance
    WHERE user_id = v_user_id;
  END IF;

  IF v_net IS NULL OR v_net = 0 THEN
    RAISE EXCEPTION 'Nessun saldo da conguagliare';
  END IF;

  -- Direzione del bonifico.
  IF v_net > 0 THEN
    -- L'utente corrente ha anticipato: l'altro paga a lui.
    v_from := v_other_user_id;
    v_to   := v_user_id;
  ELSE
    v_from := v_user_id;
    v_to   := v_other_user_id;
  END IF;

  INSERT INTO public.settlements (amount, from_user_id, to_user_id, notes, created_by)
  VALUES (abs(v_net), v_from, v_to, p_notes, v_user_id)
  RETURNING id INTO v_settlement_id;

  IF p_expense_ids IS NOT NULL THEN
    UPDATE public.expenses
    SET settlement_id = v_settlement_id
    WHERE id = ANY(p_expense_ids)
      AND settlement_id IS NULL;
  ELSE
    UPDATE public.expenses
    SET settlement_id = v_settlement_id
    WHERE settlement_id IS NULL;
  END IF;

  RETURN v_settlement_id;
END;
$$;

-- Permetti la chiamata dal client agli utenti autenticati.
REVOKE ALL ON FUNCTION public.register_settlement(text, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.register_settlement(text, uuid[]) TO authenticated;


-- ============================================================
-- 9. BOOTSTRAP dei due profili
-- ------------------------------------------------------------
-- Da eseguire DOPO aver creato i due utenti nel pannello
-- Authentication di Supabase (Users -> Add user -> email+password).
-- Sostituisci gli UUID con quelli effettivi di auth.users.
-- ============================================================

-- Esempio:
-- INSERT INTO public.profiles (id, display_name, higher_income) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'Alice', true),
--   ('00000000-0000-0000-0000-000000000002', 'Bob',   false);


-- ============================================================
-- 10. INTEGRAZIONE TELEGRAM (notifiche + assistente nel gruppo)
-- ------------------------------------------------------------
-- Il bot Telegram scrive nel gruppo dei due conviventi a ogni movimento
-- (spesa aggiunta/modificata/eliminata, conguaglio) e risponde nel gruppo
-- interrogando l'assistente IA. Il webhook gira senza sessione utente e usa
-- la service role key: il collegamento tra chi scrive su Telegram e il profilo
-- applicativo passa da profiles.telegram_user_id (sezione 2).
-- ============================================================

-- Memoria della conversazione con il bot: il webhook e' stateless, quindi la
-- cronologia necessaria all'assistente per i dialoghi a piu' turni (es. la
-- conferma prima di registrare una spesa) vive qui. Vengono salvati solo i
-- messaggi che coinvolgono il bot, non le chiacchiere tra i due utenti.
CREATE TABLE public.telegram_messages (
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

CREATE INDEX idx_telegram_messages_chat_created
  ON public.telegram_messages (chat_id, created_at DESC);

-- RLS: la tabella e' scritta e letta dal webhook con la service role key, che
-- bypassa RLS. La policy serve solo a consentire la lettura dall'app ai due
-- utenti autorizzati, coerentemente con il resto dello schema.
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "telegram_messages_select_authorized"
  ON public.telegram_messages FOR SELECT
  TO authenticated
  USING (public.is_authorized_user());


-- ============================================================
-- 11. MODULO "GESTIONE CASA" (fase 1)
-- ------------------------------------------------------------
-- Gamification delle faccende domestiche: catalogo interamente
-- modificabile, registro dei completamenti, viste di stato e di
-- aggregazione settimanale. Applicata come migrazione separata,
-- docs/migrations/2026-09-03_gestione_casa.sql; progettazione
-- completa in docs/design-modulo-gestione-casa.md.
--
-- Deliberatamente NON modellato come il modulo spese: niente saldo,
-- niente conguaglio. Le faccende non generano un debito fra i due.
-- La fase 1 registra gli XP ma non li mostra in interfaccia.
-- ============================================================

CREATE TYPE chore_area AS ENUM (
  'cucina', 'bagno', 'pulizie', 'spazzatura', 'bucato', 'spesa', 'manutenzione', 'altro'
);

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

CREATE TRIGGER trg_chore_templates_updated_at
  BEFORE UPDATE ON public.chore_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_chore_logs_updated_at
  BEFORE UPDATE ON public.chore_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Stato di ogni faccenda attiva: ultimo completamento e scadenza derivata.
-- Le ricorrenze NON sono materializzate: nessun job, nessuna riga fantasma.
-- Il fuso e' fissato a Europe/Rome: "oggi" e "questa settimana" sono quelli
-- dei due conviventi. Per lo stesso motivo il riferimento e'
-- (now() AT TIME ZONE 'Europe/Rome')::date e non current_date, che segue il
-- fuso della sessione (UTC su Supabase) e a mezzanotte darebbe uno scarto.
CREATE VIEW public.v_chore_status
WITH (security_invoker = on) AS
SELECT
  t.id,
  t.name,
  t.area,
  t.effort_xp,
  t.cadence_days,
  t.sort_order,
  l.done_at      AS last_done_at,
  l.done_by      AS last_done_by,
  p.display_name AS last_done_by_name,
  CASE
    WHEN l.done_at IS NULL THEN NULL
    ELSE ((now() AT TIME ZONE 'Europe/Rome')::date - (l.done_at AT TIME ZONE 'Europe/Rome')::date)
  END::int AS days_since,
  CASE
    WHEN t.cadence_days IS NULL THEN NULL
    WHEN l.done_at IS NULL THEN 0
    ELSE t.cadence_days - ((now() AT TIME ZONE 'Europe/Rome')::date - (l.done_at AT TIME ZONE 'Europe/Rome')::date)
  END::int AS due_in_days
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

-- Aggregato settimanale per utente. In fase 1 alimenta solo l'analisi dei
-- dati (gli XP sono registrati ma non mostrati); dalla fase 2 obiettivo ed
-- equilibrio.
CREATE VIEW public.v_chore_week
WITH (security_invoker = on) AS
SELECT
  date_trunc('week', (l.done_at AT TIME ZONE 'Europe/Rome'))::date AS week_start,
  l.done_by      AS user_id,
  p.display_name,
  count(*)::int  AS chore_count,
  sum(l.xp)::int AS xp
FROM public.chore_logs l
JOIN public.profiles p ON p.id = l.done_by
GROUP BY 1, 2, 3;

COMMENT ON VIEW public.v_chore_week IS
  'XP e numero di faccende per utente e per settimana ISO (fuso Europe/Rome).';

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

-- Catalogo iniziale: tarato sulla casa reale (niente lavastoviglie, stiro,
-- piante, balcone, giardino o animali; lavatrice settimanale; lenzuola ogni
-- due settimane). E' solo il contenuto di partenza della tabella: tutto e'
-- modificabile dall'app (docs/design-modulo-gestione-casa.md § 5).
INSERT INTO public.chore_templates (name, area, effort_xp, cadence_days, sort_order) VALUES
  ('Cucinare la cena',                     'cucina',     20, 1,    10),
  ('Lavare i piatti a mano',               'cucina',     20, 1,    20),
  ('Sparecchiare e riordinare la cucina',  'cucina',      8, 1,    30),
  ('Pulire il piano cottura',              'cucina',     10, 3,    40),
  ('Pulire il frigo / buttare l''avanzato', 'cucina',    10, 14,   50),
  ('Preparare il pranzo all''altro',        'cucina',     8, NULL, 60),
  ('Fare la spesa',                        'spesa',      30, 7,    70),
  ('Giro di riordino (mini task)',         'pulizie',     5, 1,    80),
  ('Riordinare il soggiorno',              'pulizie',    10, 3,    90),
  ('Aspirare / spazzare',                  'pulizie',    20, 4,   100),
  ('Lavare i pavimenti',                   'pulizie',    25, 7,   110),
  ('Spolverare',                           'pulizie',    15, 14,  120),
  ('Pulire il bagno a fondo',              'bagno',      25, 7,   130),
  ('Lavandino e specchio',                 'bagno',       8, 3,   140),
  ('Fare la lavatrice',                    'bucato',     10, 7,   150),
  ('Stendere il bucato',                   'bucato',     15, 7,   160),
  ('Ritirare e piegare',                   'bucato',     20, 7,   170),
  ('Cambiare le lenzuola',                 'bucato',     15, 14,  180),
  ('Cambiare gli asciugamani',             'bucato',      5, 7,   190),
  ('Portare fuori la spazzatura',          'spazzatura',  5, 2,   200),
  ('Vetro / plastica / carta',             'spazzatura',  8, 7,   210),
  ('Rifare il letto',                      'altro',       3, 1,   220);


-- ============================================================
-- 12. MODULO "GESTIONE CASA" (fase 2 — obiettivo, striscia, kudos)
-- ------------------------------------------------------------
-- Il gioco sopra le liste della fase 1: obiettivo settimanale di
-- casa, striscia, barra di equilibrio, kudos. Applicata come due
-- migrazioni separate,
-- docs/migrations/2026-09-03_gestione_casa_fase2.sql (kudos +
-- current_chore_week_start) e
-- docs/migrations/2026-09-03_gestione_casa_fase2b.sql
-- (v_chore_week_area, per la rifinitura UI); progettazione in
-- docs/design-modulo-gestione-casa.md.
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

-- Kudos per settimana (fuso Europe/Rome), per il conteggio degli XP di
-- casa nell'obiettivo settimanale.
CREATE VIEW public.v_chore_kudos_week
WITH (security_invoker = on) AS
SELECT
  date_trunc('week', (created_at AT TIME ZONE 'Europe/Rome'))::date AS week_start,
  count(*)::int AS kudos_count
FROM public.chore_kudos
GROUP BY 1;

COMMENT ON VIEW public.v_chore_kudos_week IS
  'Numero di kudos per settimana ISO (fuso Europe/Rome). Ogni kudos vale KUDOS_XP (lib/chores/config.ts) sul totale settimanale di casa, ma non è attribuito a nessuno dei due utenti.';

-- Faccende per area e per settimana, a livello di CASA (non per utente):
-- alimenta i chip di riepilogo nella card "La nostra settimana". Niente
-- colonna utente di proposito — non deve poter diventare un confronto fra
-- i due, nemmeno per errore riusando "solo" i dati che già ci sono.
CREATE VIEW public.v_chore_week_area
WITH (security_invoker = on) AS
SELECT
  date_trunc('week', (done_at AT TIME ZONE 'Europe/Rome'))::date AS week_start,
  area,
  count(*)::int AS chore_count,
  sum(xp)::int  AS xp
FROM public.chore_logs
GROUP BY 1, 2;

COMMENT ON VIEW public.v_chore_week_area IS
  'Faccende per area e per settimana ISO (fuso Europe/Rome), a livello di casa: nessuna suddivisione per utente, di proposito.';

-- Inizio della settimana corrente, stesso fuso e stessa semantica delle
-- viste sopra. Evita di reimplementare date_trunc('week', ...) lato client
-- con tutte le insidie dei fusi orari. search_path fissato esplicitamente
-- (pg_catalog basta: la funzione non tocca nessuna tabella).
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


-- ============================================================
-- FINE SCHEMA
-- ============================================================
