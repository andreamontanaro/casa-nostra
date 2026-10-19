-- ============================================================
-- Casa Nostra - Energia: potenza delle ultime 6 ore
-- ------------------------------------------------------------
-- La pagina "Consumo in tempo reale" di MyFastweb ha un grafico
-- della potenza minuto per minuto nelle ultime 6 ore (action
-- consumptionLatest). La schermata Energia lo mostra sotto la
-- batteria; come le altre letture, l'ultima serie si tiene nella
-- riga unica di energy_fastweb_state e si rilegge da Fastweb al
-- massimo una volta al minuto.
--
-- Da eseguire nell'editor SQL di Supabase PRIMA di pubblicare il
-- codice che le usa. Replicata nella sezione 15 di
-- docs/casa_nostra_schema.sql.
-- ============================================================

ALTER TABLE public.energy_fastweb_state
  ADD COLUMN history     jsonb,
  ADD COLUMN history_at  timestamptz;

COMMENT ON COLUMN public.energy_fastweb_state.history IS
  'Potenza delle ultime 6 ore, un punto al minuto: { points: [{ at, watts }], peakWatts }. Solo numeri e orari.';
