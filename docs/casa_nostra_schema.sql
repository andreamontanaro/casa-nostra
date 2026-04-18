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
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   text NOT NULL CHECK (length(trim(display_name)) > 0),
  higher_income  boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'Estende auth.users con i dati applicativi. Esattamente due righe previste.';

COMMENT ON COLUMN public.profiles.higher_income IS
  'True per il partner con reddito maggiore (paga 60% nella regola 60/40). Al massimo uno dei due profili puo'' avere true.';

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


-- ============================================================
-- 8. FUNZIONE register_settlement (conguaglio transazionale)
-- ============================================================

-- Calcola il saldo netto corrente, crea una riga in settlements
-- e marca come saldate tutte le spese aperte, in un'unica transazione.
CREATE OR REPLACE FUNCTION public.register_settlement(p_notes text DEFAULT NULL)
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

  SELECT net_position INTO v_net
  FROM public.v_user_open_balance
  WHERE user_id = v_user_id;

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

  UPDATE public.expenses
  SET settlement_id = v_settlement_id
  WHERE settlement_id IS NULL;

  RETURN v_settlement_id;
END;
$$;

-- Permetti la chiamata dal client agli utenti autenticati.
REVOKE ALL ON FUNCTION public.register_settlement(text) FROM public;
GRANT EXECUTE ON FUNCTION public.register_settlement(text) TO authenticated;


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
-- FINE SCHEMA
-- ============================================================
