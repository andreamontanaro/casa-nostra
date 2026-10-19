-- ============================================================
-- Casa Nostra - Spesa interamente a carico dell'altra persona
-- ------------------------------------------------------------
-- Caso d'uso: Andrea anticipa una spesa personale di Fede (o il
-- contrario). La spesa si registra cosi' com'e', pagata da chi l'ha
-- pagata, e l'intero importo va a carico di chi NON ha pagato.
--
-- Nuova regola di divisione 'full_other'. E' una regola e non un
-- numero: se poi si corregge l'importo, la quota segue da sola
-- (con 'custom' resterebbe la cifra vecchia). Non serve una colonna
-- per dire "a carico di chi": e' sempre l'altra persona rispetto a
-- paid_by. A carico di chi paga non avrebbe senso, non sposterebbe
-- il saldo.
--
-- Il check expenses_custom_share_consistency vale gia' anche per la
-- regola nuova (custom_other_share resta NULL). register_settlement
-- legge le quote da v_expense_shares: non cambia.
--
-- Da eseguire nell'editor SQL di Supabase PRIMA di pubblicare il
-- codice che la usa. Applicare i due blocchi in DUE esecuzioni
-- separate: Postgres non permette di USARE un valore enum nella
-- stessa transazione che lo crea. Replicata nelle sezioni 1 e 6 di
-- docs/casa_nostra_schema.sql.
-- ============================================================


-- ---- BLOCCO 1: il tipo ------------------------------------------------

ALTER TYPE public.split_rule ADD VALUE IF NOT EXISTS 'full_other';


-- ---- BLOCCO 2: le quote (esecuzione separata) -------------------------

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
    WHEN e.split_rule = 'full_other' AND p.id <> e.paid_by    THEN e.amount
    WHEN e.split_rule = 'full_other' AND p.id  = e.paid_by    THEN 0
  END::numeric(10,2) AS user_share
FROM public.expenses e
CROSS JOIN public.profiles p;
