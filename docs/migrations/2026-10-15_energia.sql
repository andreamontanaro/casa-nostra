-- ============================================================
-- Casa Nostra - Energia: collegamento con Fastweb Power Control
-- ------------------------------------------------------------
-- La schermata Energia legge potenza istantanea e consumi dalle
-- chiamate interne di MyFastweb, con login username/password. Per
-- non rifare il login a ogni lettura (e non far scattare il
-- captcha) la sessione MyFastweb si conserva qui, cifrata, insieme
-- all'ultima lettura: due telefoni che guardano la schermata fanno
-- una sola chiamata a Fastweb.
--
-- Una riga sola (id = 1). RLS attiva SENZA policy: anon e
-- authenticated non leggono e non scrivono niente. Ci arriva solo
-- il service role, dalla rotta /api/energia (lib/energy/).
--
-- Da eseguire nell'editor SQL di Supabase. Replicata nella
-- sezione 15 di docs/casa_nostra_schema.sql.
-- ============================================================

CREATE TABLE public.energy_fastweb_state (
  id                 smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Cookie e token dei form MyFastweb, cifrati (AES-256-GCM) con una
  -- chiave derivata dalle credenziali: senza FASTWEB_PASSWORD non
  -- servono a niente.
  session_enc        text,
  -- Ultimo tentativo di login, riuscito o no: ne parte al massimo
  -- uno ogni pochi minuti, ed e' anche il lucchetto contro due login
  -- in parallelo (UPDATE condizionale su questa colonna).
  login_attempt_at   timestamptz,
  logged_in_at       timestamptz,
  -- Fastweb ha chiesto il captcha o ha rifiutato le credenziali:
  -- niente login fino a blocked_until. Il blocco vale solo per le
  -- credenziali con questa impronta: cambiandole si riprova subito.
  blocked_until      timestamptz,
  blocked_reason     text CHECK (blocked_reason IN ('captcha', 'rifiutato')),
  blocked_for        text,
  -- Ultime letture gia' ripulite (solo numeri ed etichette, mai i
  -- dati dell'intestatario).
  realtime           jsonb,
  realtime_at        timestamptz,
  details            jsonb,
  details_at         timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.energy_fastweb_state IS
  'Sessione MyFastweb (cifrata) e ultime letture di Power Control. Riga unica, accessibile solo con il service role.';

INSERT INTO public.energy_fastweb_state (id) VALUES (1);

ALTER TABLE public.energy_fastweb_state ENABLE ROW LEVEL SECURITY;
-- Nessuna policy, di proposito. Per sicurezza anche niente privilegi:
REVOKE ALL ON public.energy_fastweb_state FROM anon, authenticated;
