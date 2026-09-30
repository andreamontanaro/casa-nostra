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

-- Categorie di spesa. Tarate sull'uso reale dopo i primi 5 mesi
-- (vedi docs/migrations/2026-09-08_categorie_spese.sql): 'manutenzione' era
-- rimasta a zero righe perche' la parola e' troppo stretta, e 'altro'
-- raccoglieva il 39% delle spese nascondendo due cluster evidenti.
-- La categoria descrive la NATURA della spesa, non il contesto: un pranzo
-- e' 'ristorazione' anche in vacanza, la benzina e' 'trasporti' anche in
-- vacanza. 'viaggi' resta per alloggi, biglietti e pacchetti.
CREATE TYPE expense_category AS ENUM (
  'affitto',
  'bolletta',          -- utenze e tasse sulla casa (luce, gas, acqua, TARI)
  'spesa_alimentare',  -- supermercato e alimentari, incluso il non-food comprato li'
  'ristorazione',      -- mangiare e bere fuori casa
  'abbonamento',       -- servizi ricorrenti (streaming, internet, telefono)
  'casa_arredo',       -- arredamento, elettrodomestici, casalinghi, riparazioni
  'trasporti',         -- benzina, pedaggi, parcheggi, mezzi pubblici
  'viaggi',            -- alloggi, biglietti, pacchetti vacanza
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
  works_from_home  boolean NOT NULL DEFAULT false,
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

COMMENT ON COLUMN public.profiles.works_from_home IS
  'True per il partner che lavora da casa: dal lunedi'' al venerdi'' ha una tacca in piu'' nella bottiglia delle faccende, e la sua prima faccenda del giorno e'' un bonus che non entra nel confronto (sezione 14). Al massimo uno dei due profili puo'' avere true.';

-- Vincolo: al massimo un profilo con works_from_home = true
CREATE UNIQUE INDEX profiles_only_one_works_from_home
  ON public.profiles ((true))
  WHERE works_from_home = true;


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
-- 11-12. MODULO "GESTIONE CASA" (rimosso)
-- ------------------------------------------------------------
-- Faccende con XP, obiettivo settimanale, striscia e kudos. Tabelle,
-- viste e funzioni sono state eliminate con
-- docs/migrations/2026-09-08_remove_gestione_casa.sql; le migrazioni
-- originali (2026-09-03_gestione_casa*.sql) restano come storia.
-- Le faccende sono tornate con un modello diverso: sezione 14.
-- ============================================================


-- ============================================================
-- 13. MODULO "LISTA DELLA SPESA"
-- ------------------------------------------------------------
-- Cosa manca in casa e cosa va comprato: articoli categorizzati
-- per tipo di prodotto, con quantita' libera e urgenza, piu' il
-- controllo dello scontrino che spunta in automatico cio' che e'
-- gia' stato comprato ed evidenzia cosa manca ancora.
-- Applicata come migrazione separata,
-- docs/migrations/2026-09-06_lista_spesa.sql.
--
-- Come il modulo spese e a differenza delle faccende, la lista e'
-- di casa: entrambi aggiungono, spuntano e cancellano qualsiasi
-- riga. Non genera nessun saldo: cosa serve non e' un debito.
-- ============================================================

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------

-- Tipo di prodotto. Deliberatamente diversa da expense_category:
-- li' si classifica una spesa (una riga di denaro), qui un prodotto
-- da mettere nel carrello. Niente 'animali': in questa casa non ce
-- ne sono (stessa taratura sulla casa reale del catalogo faccende).
CREATE TYPE shopping_category AS ENUM (
  'cibo',
  'bevande',
  'cura_casa',       -- detersivi, prodotti per la pulizia
  'igiene_persona',  -- shampoo, dentifricio, carta igienica
  'farmacia',
  'casalinghi',      -- lampadine, pile, utensili
  'altro'
);

-- Ordine di dichiarazione = ordine di ORDER BY: 'alta' e' l'ultimo,
-- quindi la lista si ordina per urgency DESC.
CREATE TYPE shopping_urgency AS ENUM ('bassa', 'media', 'alta');


-- ------------------------------------------------------------
-- Controlli scontrino
-- ------------------------------------------------------------
-- Un controllo = uno scontrino letto e confrontato con la lista.
-- La riga resta anche dopo che gli articoli spuntati sono stati
-- eliminati: e' il riferimento temporale di "dall'ultimo scontrino".

CREATE TABLE public.shopping_receipt_checks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path   text NOT NULL UNIQUE,
  file_name      text NOT NULL,
  mime_type      text NOT NULL,
  size_bytes     bigint NOT NULL CHECK (size_bytes > 0),
  source         text NOT NULL CHECK (source IN ('app', 'telegram', 'spesa')),
  store_name     text,
  receipt_date   date,
  receipt_total  numeric(10,2) CHECK (receipt_total IS NULL OR receipt_total > 0),
  lines          jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_count  int NOT NULL DEFAULT 0 CHECK (matched_count >= 0),
  checked_by     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  checked_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.shopping_receipt_checks IS
  'Uno scontrino letto e confrontato con la lista della spesa. Sopravvive agli articoli che ha spuntato: e'' il riferimento temporale di "dall''ultimo scontrino".';
COMMENT ON COLUMN public.shopping_receipt_checks.source IS
  'Da dove e'' arrivato lo scontrino: ''app'' (caricato dalla lista), ''telegram'' (foto nel gruppo), ''spesa'' (allegato gia'' presente su una spesa).';
COMMENT ON COLUMN public.shopping_receipt_checks.lines IS
  'Righe lette dallo scontrino: [{"name": "...", "quantity": "...", "price": 1.23}]. Conservate per poter rileggere un controllo senza riaprire l''immagine.';

CREATE INDEX idx_shopping_receipt_checks_checked_at
  ON public.shopping_receipt_checks (checked_at DESC);


-- ------------------------------------------------------------
-- Articoli della lista
-- ------------------------------------------------------------
-- Stesso pattern di stato delle spese (settlement_id IS NULL =>
-- aperta): bought_at IS NULL => ancora da comprare.

CREATE TABLE public.shopping_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL CHECK (length(trim(name)) > 0),
  category         shopping_category NOT NULL DEFAULT 'altro',
  quantity         text CHECK (quantity IS NULL OR length(trim(quantity)) > 0),
  urgency          shopping_urgency NOT NULL DEFAULT 'media',
  note             text,
  bought_at        timestamptz,
  bought_by        uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  bought_via       text CHECK (bought_via IN ('app', 'assistente', 'scontrino')),
  receipt_check_id uuid REFERENCES public.shopping_receipt_checks(id) ON DELETE SET NULL,
  receipt_line     text,
  added_by         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- Comprato o non comprato, mai a meta': o ci sono tutti e tre i
  -- dati dell'acquisto o non ce n'e' nessuno.
  CONSTRAINT shopping_items_bought_consistency CHECK (
    (bought_at IS NULL     AND bought_by IS NULL     AND bought_via IS NULL) OR
    (bought_at IS NOT NULL AND bought_by IS NOT NULL AND bought_via IS NOT NULL)
  ),
  -- Il riferimento allo scontrino ha senso solo su un articolo spuntato
  -- da uno scontrino.
  CONSTRAINT shopping_items_receipt_consistency CHECK (
    receipt_check_id IS NULL OR bought_via = 'scontrino'
  )
);

COMMENT ON TABLE public.shopping_items IS
  'Lista della spesa: cosa manca e cosa va comprato. bought_at IS NULL => da comprare; valorizzato => gia'' comprato (storico).';
COMMENT ON COLUMN public.shopping_items.quantity IS
  'Quantita'' in testo libero ("2 confezioni", "1 kg", "una bottiglia grande"): al supermercato si ragiona cosi'', non con un numero e un''unita'' di misura.';
COMMENT ON COLUMN public.shopping_items.bought_via IS
  'Come e'' stato spuntato: a mano nell''app, dall''assistente, o in automatico dal controllo di uno scontrino.';
COMMENT ON COLUMN public.shopping_items.receipt_line IS
  'La riga dello scontrino che ha spuntato l''articolo, cosi'' si vede perche'' e'' stato considerato comprato.';

CREATE INDEX idx_shopping_items_open
  ON public.shopping_items (urgency DESC, created_at)
  WHERE bought_at IS NULL;
CREATE INDEX idx_shopping_items_bought_at
  ON public.shopping_items (bought_at DESC);
CREATE INDEX idx_shopping_items_receipt_check
  ON public.shopping_items (receipt_check_id);

-- Niente doppioni tra gli articoli ancora da comprare: "Latte" e
-- "  latte " sono la stessa cosa. Il vincolo vale solo sugli articoli
-- aperti, cosi' lo storico puo' contenere "Latte" quante volte serve.
CREATE UNIQUE INDEX shopping_items_unique_open_name
  ON public.shopping_items (lower(trim(name)))
  WHERE bought_at IS NULL;

CREATE TRIGGER trg_shopping_items_updated_at
  BEFORE UPDATE ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ------------------------------------------------------------
-- Viste
-- ------------------------------------------------------------

-- L'ultimo scontrino controllato. Una vista con LIMIT 1 invece di un
-- "order by + limit" ripetuto in ogni chiamante (app, assistente, bot).
CREATE VIEW public.v_shopping_last_check
WITH (security_invoker = on) AS
SELECT
  c.id,
  c.storage_path,
  c.file_name,
  c.source,
  c.store_name,
  c.receipt_date,
  c.receipt_total,
  c.matched_count,
  c.checked_by,
  p.display_name AS checked_by_name,
  c.checked_at
FROM public.shopping_receipt_checks c
LEFT JOIN public.profiles p ON p.id = c.checked_by
ORDER BY c.checked_at DESC
LIMIT 1;

COMMENT ON VIEW public.v_shopping_last_check IS
  'L''ultimo scontrino controllato, o nessuna riga se non ne e'' mai stato inviato uno.';

-- Cosa NON e' stato comprato con l'ultimo scontrino: gli articoli
-- ancora aperti che erano gia' in lista quando lo scontrino e' stato
-- controllato. Un articolo aggiunto DOPO il controllo non e' "non
-- comprato", e' semplicemente arrivato dopo: il CROSS JOIN con la
-- vista dell'ultimo controllo non produce righe se non c'e' nessuno
-- scontrino, che e' esattamente la risposta giusta.
CREATE VIEW public.v_shopping_missing_since_last_check
WITH (security_invoker = on) AS
SELECT
  i.id,
  i.name,
  i.category,
  i.quantity,
  i.urgency,
  i.note,
  i.created_at,
  c.id         AS check_id,
  c.checked_at AS check_checked_at,
  c.store_name AS check_store_name
FROM public.shopping_items i
CROSS JOIN public.v_shopping_last_check c
WHERE i.bought_at IS NULL
  AND i.created_at < c.checked_at;

COMMENT ON VIEW public.v_shopping_missing_since_last_check IS
  'Articoli ancora da comprare che erano gia'' in lista al momento dell''ultimo controllo scontrino. Vuota se non e'' mai stato controllato uno scontrino.';


-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
-- Come il modulo spese e a differenza di chore_logs: la lista e' di
-- casa, non di chi ha scritto la riga. Entrambi aggiungono, spuntano
-- e cancellano qualsiasi articolo.

ALTER TABLE public.shopping_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_receipt_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopping_items_all_authorized"
  ON public.shopping_items FOR ALL
  TO authenticated
  USING (public.is_authorized_user())
  WITH CHECK (public.is_authorized_user());

CREATE POLICY "shopping_receipt_checks_all_authorized"
  ON public.shopping_receipt_checks FOR ALL
  TO authenticated
  USING (public.is_authorized_user())
  WITH CHECK (public.is_authorized_user());


-- ------------------------------------------------------------
-- Storage: bucket privato per le foto degli scontrini controllati
-- ------------------------------------------------------------
-- Separato da expense-attachments: uno scontrino controllato non e'
-- l'allegato di una spesa, e cancellare una spesa non deve portarsi
-- via la prova di un controllo.

INSERT INTO storage.buckets (id, name, public)
VALUES ('shopping-receipts', 'shopping-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "sr_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shopping-receipts' AND public.is_authorized_user());
CREATE POLICY "sr_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shopping-receipts' AND public.is_authorized_user());
CREATE POLICY "sr_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shopping-receipts' AND public.is_authorized_user())
  WITH CHECK (bucket_id = 'shopping-receipts' AND public.is_authorized_user());
CREATE POLICY "sr_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shopping-receipts' AND public.is_authorized_user());


-- ------------------------------------------------------------
-- register_receipt_check: controllo scontrino in una transazione
-- ------------------------------------------------------------
-- Stessa filosofia di register_settlement: la scrittura che tocca due
-- tabelle (il controllo + gli articoli che spunta) sta sul database,
-- non a meta' strada in una Server Action che puo' fallire in mezzo.

CREATE OR REPLACE FUNCTION public.register_receipt_check(
  p_storage_path  text,
  p_file_name     text,
  p_mime_type     text,
  p_size_bytes    bigint,
  p_source        text,
  p_item_ids      uuid[] DEFAULT '{}',
  p_lines         jsonb  DEFAULT '[]'::jsonb,
  p_store_name    text   DEFAULT NULL,
  p_receipt_date  date   DEFAULT NULL,
  p_receipt_total numeric DEFAULT NULL,
  -- Usato solo dal webhook Telegram, che gira con la service role e
  -- quindi non ha auth.uid(). Con una sessione vera viene ignorato:
  -- il controllo lo firma chi lo sta facendo, non chi lo dichiara.
  p_checked_by    uuid   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid;
  v_role     text;
  v_check_id uuid;
  v_matched  int;
BEGIN
  -- Ruolo del chiamante secondo il JWT (anon | authenticated | service_role).
  -- current_user non serve: dentro SECURITY DEFINER e' sempre il proprietario.
  v_role := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );

  -- p_checked_by e' accettato SOLO dal client service role: Supabase concede
  -- EXECUTE ad anon su ogni funzione nuova in public, e senza questo vincolo
  -- un chiamante anonimo potrebbe dichiararsi un profilo qualsiasi su una
  -- funzione SECURITY DEFINER, che scavalca RLS.
  v_user := CASE
    WHEN auth.uid() IS NOT NULL   THEN auth.uid()      -- sessione vera: vince sempre
    WHEN v_role = 'service_role'  THEN p_checked_by    -- webhook Telegram
    ELSE NULL                                          -- anonimo: nessuna identita'
  END;

  IF v_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user) THEN
    RAISE EXCEPTION 'Utente non autorizzato';
  END IF;

  INSERT INTO public.shopping_receipt_checks (
    storage_path, file_name, mime_type, size_bytes, source,
    store_name, receipt_date, receipt_total, lines, checked_by
  ) VALUES (
    p_storage_path, p_file_name, p_mime_type, p_size_bytes, p_source,
    p_store_name, p_receipt_date, p_receipt_total, COALESCE(p_lines, '[]'::jsonb), v_user
  )
  RETURNING id INTO v_check_id;

  -- Spunta solo gli articoli ancora aperti: se nel frattempo uno e'
  -- stato spuntato a mano, resta com'era invece di cambiare autore.
  WITH marked AS (
    UPDATE public.shopping_items
       SET bought_at        = now(),
           bought_by        = v_user,
           bought_via       = 'scontrino',
           receipt_check_id = v_check_id
     WHERE id = ANY(COALESCE(p_item_ids, '{}'))
       AND bought_at IS NULL
    RETURNING 1
  )
  SELECT count(*)::int INTO v_matched FROM marked;

  UPDATE public.shopping_receipt_checks
     SET matched_count = v_matched
   WHERE id = v_check_id;

  RETURN v_check_id;
END;
$$;

COMMENT ON FUNCTION public.register_receipt_check IS
  'Registra un controllo scontrino e spunta in un''unica transazione gli articoli riconosciuti. Ritorna l''id del controllo. Firma con auth.uid(); p_checked_by e'' accettato solo dal client service role.';

-- `FROM public` da solo non basta: Supabase concede EXECUTE ad anon su ogni
-- funzione nuova in public (default privileges), con un grant esplicito.
REVOKE ALL ON FUNCTION public.register_receipt_check FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_receipt_check TO authenticated, service_role;


-- ============================================================
-- 14. MODULO "FACCENDE DOMESTICHE"
-- ------------------------------------------------------------
-- Due bottiglie, una per persona: ogni faccenda riempie una tacca e
-- tutte valgono uguale. Chi lavora da casa (profiles.works_from_home)
-- ha una tacca bonus dal lunedi' al venerdi'. Chi resta indietro si
-- porta il debito ai giorni successivi, senza limite; le bottiglie si
-- svuotano ogni mezzanotte. Nessun legame con i soldi, nessuna
-- notifica. Applicata come migrazione separata,
-- docs/migrations/2026-09-30_faccende.sql.
-- ============================================================

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
-- Azioni create da voi (docs/migrations/2026-09-30_faccende_azioni.sql)
-- ------------------------------------------------------------
-- Accanto alle azioni predefinite nel codice (lib/chores/presets.ts).
-- Solo una scorciatoia per il nome: eliminarle non tocca chore_entries.

CREATE TABLE public.chore_presets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
  -- Gli ambiti di lib/chores/presets.ts (CHORE_PRESET_GROUPS): la
  -- corrispondenza la controlla tests/chores.test.mjs.
  group_id    text NOT NULL CHECK (group_id IN (
                'cucina', 'pulizie', 'bagno', 'bucato', 'rifiuti', 'spesa', 'manutenzione'
              )),
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chore_presets IS
  'Azioni delle faccende aggiunte dai due utenti, accanto a quelle predefinite nel codice. Solo una scorciatoia per il nome: eliminarle non tocca chore_entries.';

-- "Pulisco la cappa" e " pulisco la cappa" sono la stessa azione.
CREATE UNIQUE INDEX chore_presets_unique_name
  ON public.chore_presets (lower(trim(name)));

-- Come la lista della spesa: le azioni sono di casa, entrambi le
-- aggiungono e le tolgono.
ALTER TABLE public.chore_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chore_presets_select_authorized"
  ON public.chore_presets FOR SELECT
  TO authenticated
  USING (public.is_authorized_user());

CREATE POLICY "chore_presets_insert_authorized"
  ON public.chore_presets FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user() AND created_by = auth.uid());

CREATE POLICY "chore_presets_delete_authorized"
  ON public.chore_presets FOR DELETE
  TO authenticated
  USING (public.is_authorized_user());


-- ------------------------------------------------------------
-- Nomi tolti dai "Recenti" (docs/migrations/2026-09-30_faccende_recenti.sql)
-- ------------------------------------------------------------
-- Nasconde un nome dai suggerimenti finche' non viene segnato di
-- nuovo. Non tocca chore_entries: bottiglie e arretrato restano.

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


-- ------------------------------------------------------------
-- Suggerimenti all'altra persona (docs/migrations/2026-09-30_faccende_suggerimenti.sql)
-- ------------------------------------------------------------
-- Compaiono sbiaditi nelle tacche libere di chi li riceve, non contano
-- per la parita' finche' non vengono confermati e scadono a mezzanotte.

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


-- ============================================================
-- FINE SCHEMA
-- ============================================================
