-- ============================================================
-- Casa Nostra - Modulo "Gestione casa" (rifinitura UI, fase 2)
-- ------------------------------------------------------------
-- Riepilogo settimanale per area, a livello di CASA (non per
-- utente): alimenta i chip di riepilogo nella card "La nostra
-- settimana". Deliberatamente senza suddivisione per persona — è
-- la stessa cautela di v_chore_week_area rispetto a v_chore_week:
-- un riepilogo per area non deve poter diventare un confronto.
-- ============================================================

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
