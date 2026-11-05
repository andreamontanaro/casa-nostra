-- ============================================================
-- Casa Nostra - Abbonamenti ricorrenti
-- ------------------------------------------------------------
-- Caso d'uso (richiesta del 5 novembre 2026): Internet di casa,
-- 45 EUR addebitati ogni 8 del mese, divisi 50/50. La spesa si
-- registra da sola il giorno dell'addebito, all'ora scelta, con una
-- notifica nel gruppo Telegram; 3 giorni prima arriva un promemoria.
--
-- Un abbonamento e' lo stampo di una spesa (importo, descrizione,
-- categoria, regola di divisione, chi paga) piu' una cadenza: un
-- giorno del mese e ogni quanti mesi. Il giorno 29-31 nei mesi corti
-- diventa l'ultimo giorno del mese. Le date le calcola
-- lib/subscriptions/schedule.ts (testato); qui stanno i dati e il
-- registro che impedisce i doppioni.
--
-- Le spese create sono spese normali: entrano nel saldo e nel
-- conguaglio come le altre, si modificano e si eliminano dallo
-- storico. Eliminare l'abbonamento non tocca le spese gia' create.
--
-- BLOCCO 1: da eseguire nell'editor SQL di Supabase PRIMA di
-- pubblicare il codice. BLOCCO 2 (pg_cron): DOPO aver pubblicato
-- il codice e impostato CRON_SECRET su Vercel, sostituendo i due
-- segnaposto. Replicata nella sezione 16 di docs/casa_nostra_schema.sql.
-- ============================================================


-- ---- BLOCCO 1: tabelle e RLS -----------------------------------------

CREATE TABLE public.subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description         text NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 80),
  amount              numeric(10,2) NOT NULL CHECK (amount > 0),
  category            expense_category NOT NULL DEFAULT 'abbonamento',
  split_rule          split_rule NOT NULL,
  custom_other_share  numeric(10,2)
    CONSTRAINT subscriptions_custom_other_share_positive
      CHECK (custom_other_share IS NULL OR custom_other_share > 0),
  CONSTRAINT subscriptions_custom_share_consistency CHECK (
    (split_rule = 'custom' AND custom_other_share IS NOT NULL AND custom_other_share < amount) OR
    (split_rule <> 'custom' AND custom_other_share IS NULL)
  ),
  -- Di chi e' la carta o il conto su cui arriva l'addebito: diventa
  -- paid_by (e created_by) della spesa.
  paid_by             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  -- Cadenza: il giorno del mese e ogni quanti mesi, a partire dal
  -- mese di start_month (sempre il primo del mese). L'addebito k-esimo
  -- cade nel mese start_month + k * interval_months.
  charge_day          smallint NOT NULL CHECK (charge_day BETWEEN 1 AND 31),
  interval_months     smallint NOT NULL DEFAULT 1 CHECK (interval_months IN (1, 2, 3, 6, 12)),
  start_month         date NOT NULL CHECK (extract(day FROM start_month) = 1),
  -- Sospeso: niente spese ne' promemoria. Riattivandolo si riparte
  -- dal prossimo addebito, senza recuperare quelli saltati.
  active              boolean NOT NULL DEFAULT true,
  created_by          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscriptions IS
  'Abbonamenti ricorrenti: lo stampo di una spesa che si registra da sola il giorno dell''addebito (giorno charge_day, ogni interval_months mesi da start_month).';

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Registro degli addebiti: una riga per abbonamento e data, creata
-- dal primo dei due eventi (promemoria o addebito). L'indice unico e'
-- il lucchetto di idempotenza, come update_id per Telegram: due
-- esecuzioni del cron in parallelo non possono creare due spese.
CREATE TABLE public.subscription_charges (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  due_on           date NOT NULL,
  reminded_at      timestamptz,
  charged_at       timestamptz,
  -- SET NULL: se la spesa viene eliminata dallo storico l'addebito
  -- resta registrato (charged_at) e non viene ricreato.
  expense_id       uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_charges_unique_due UNIQUE (subscription_id, due_on)
);

COMMENT ON TABLE public.subscription_charges IS
  'Promemoria inviati e spese create per ogni addebito di un abbonamento. UNIQUE (subscription_id, due_on) impedisce i doppioni.';

CREATE INDEX idx_subscription_charges_expense
  ON public.subscription_charges (expense_id)
  WHERE expense_id IS NOT NULL;


-- Impostazioni del modulo, riga unica: l'ora (Europe/Rome) da cui
-- partono addebiti e promemoria, la stessa per tutti gli abbonamenti.
CREATE TABLE public.subscription_settings (
  id           smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  notify_hour  smallint NOT NULL DEFAULT 9 CHECK (notify_hour BETWEEN 0 AND 23),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscription_settings IS
  'Riga unica: notify_hour e'' l''ora (Europe/Rome) da cui il cron registra gli addebiti del giorno e manda i promemoria.';

INSERT INTO public.subscription_settings (id) VALUES (1);

CREATE TRIGGER trg_subscription_settings_updated_at
  BEFORE UPDATE ON public.subscription_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- RLS: come le spese, gli abbonamenti sono di casa. Il cron scrive
-- con il service role (nessuna sessione), che bypassa RLS.
ALTER TABLE public.subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_charges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_all_authorized"
  ON public.subscriptions FOR ALL
  TO authenticated
  USING (public.is_authorized_user())
  WITH CHECK (public.is_authorized_user());

-- Il registro lo scrive solo il cron: dall'app si legge e basta.
CREATE POLICY "subscription_charges_select_authorized"
  ON public.subscription_charges FOR SELECT
  TO authenticated
  USING (public.is_authorized_user());

CREATE POLICY "subscription_settings_select_authorized"
  ON public.subscription_settings FOR SELECT
  TO authenticated
  USING (public.is_authorized_user());

CREATE POLICY "subscription_settings_update_authorized"
  ON public.subscription_settings FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user())
  WITH CHECK (public.is_authorized_user());


-- ---- BLOCCO 2: la sveglia oraria (pg_cron + pg_net) -------------------
-- Una volta all'ora Supabase chiama /api/cron/abbonamenti. La rotta
-- non fa niente prima dell'ora scelta; da quell'ora in poi registra gli
-- addebiti del giorno e manda i promemoria, una volta sola (registro
-- qui sopra). Le chiamate dopo la prima del giorno non trovano lavoro.
--
-- Prima: Database > Extensions, attivare pg_cron e pg_net. Poi
-- sostituire <URL_APP> (es. https://casa-nostra.vercel.app) e
-- <CRON_SECRET> (lo stesso valore della variabile su Vercel) ed
-- eseguire. Il secret resta nel Vault di Supabase, non nel testo del job.
--
-- select vault.create_secret('<CRON_SECRET>', 'casa_nostra_cron_secret');
-- select vault.create_secret('<URL_APP>',     'casa_nostra_app_url');
--
-- select cron.schedule(
--   'casa-nostra-abbonamenti',
--   '2 * * * *',   -- al minuto 2 di ogni ora
--   $$
--   select net.http_get(
--     url := (select decrypted_secret from vault.decrypted_secrets where name = 'casa_nostra_app_url')
--            || '/api/cron/abbonamenti',
--     headers := jsonb_build_object(
--       'Authorization',
--       'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'casa_nostra_cron_secret')
--     ),
--     timeout_milliseconds := 30000
--   );
--   $$
-- );
--
-- Verifica: select * from cron.job_run_details order by start_time desc limit 5;
--           select status_code, content from net._http_response order by created desc limit 5;
-- Per toglierla: select cron.unschedule('casa-nostra-abbonamenti');
