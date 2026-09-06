-- ============================================================
-- Casa Nostra - Modulo "Lista della spesa"
-- ------------------------------------------------------------
-- Cosa manca in casa e cosa va comprato: articoli categorizzati
-- per tipo di prodotto, con quantita' libera e urgenza, piu' il
-- controllo dello scontrino che spunta in automatico cio' che e'
-- gia' stato comprato.
--
-- Da eseguire nell'editor SQL di Supabase. Replicata nella
-- sezione 13 di docs/casa_nostra_schema.sql.
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
