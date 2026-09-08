-- ============================================================
-- 2026-09-08 — Normalizzazione delle categorie di spesa
-- ============================================================
--
-- Motivazione (dai dati reali dei primi 5 mesi, 114 spese):
--
--   · 'altro' raccoglieva 44 righe su 114 (39%), ma non era rumore:
--     dentro c'erano tre cluster nettissimi — mangiare fuori (26 righe),
--     casa e arredo (19 righe, 1.514 €) e spostamenti (11 righe).
--   · 'manutenzione' non e' MAI stata usata: zero righe. La parola e'
--     troppo stretta, nessuno pensa "manutenzione" comprando un divano.
--   · benzina, caselli e parcheggi finivano indifferentemente in tre
--     categorie diverse ('altro', 'viaggi', 'spesa_alimentare').
--
-- Regola adottata: la categoria descrive la NATURA della spesa, non il
-- contesto. Un pranzo e' 'ristorazione' anche in vacanza, la benzina e'
-- 'trasporti' anche in vacanza; 'viaggi' resta per alloggi, biglietti e
-- pacchetti. E' l'unica regola che rende la scelta deterministica, che e'
-- tutto il punto della normalizzazione.
--
-- Nessun saldo cambia: la categoria non entra nel calcolo di
-- v_user_open_balance. Il backfill tocca anche le spese gia' saldate,
-- per non lasciare lo storico e le statistiche incoerenti.
--
-- Applicare i due blocchi in DUE transazioni separate: Postgres non
-- permette di USARE un valore enum nella stessa transazione che lo crea.
-- ============================================================


-- ---- BLOCCO 1: il tipo ------------------------------------------------

ALTER TYPE public.expense_category RENAME VALUE 'manutenzione' TO 'casa_arredo';

ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'ristorazione' AFTER 'spesa_alimentare';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'trasporti' BEFORE 'viaggi';

-- Ordine risultante:
--   affitto, bolletta, spesa_alimentare, ristorazione, abbonamento,
--   casa_arredo, trasporti, viaggi, altro


-- ---- BLOCCO 2: il backfill (transazione separata) ---------------------

-- da 'altro'
UPDATE public.expenses SET category = 'ristorazione'
WHERE category = 'altro' AND lower(description) IN (
  '25 aprile la casa dei falconieri', 'aquafan chicken', 'bibite', 'bking',
  'cena', 'coca', 'colaz', 'crepe', 'dolcetti giapponesi a levante for',
  'gelato', 'mcdonald''s', 'mondo sfizio', 'pizza', 'pranzo',
  'pranzo frittini', 'spesa pranzo', 'sushi', 'waffle');

UPDATE public.expenses SET category = 'trasporti'
WHERE category = 'altro' AND lower(description) IN (
  'benzina s.m.', 'benzina x bari', 'casello andata', 'parcheggio san marino');

UPDATE public.expenses SET category = 'casa_arredo'
WHERE category = 'altro' AND lower(description) IN (
  'amazon barriera doccia ferma acqua silicone', 'echo dot (amazon)', 'mobili',
  'mocho', 'prese corrente', 'spese casa', 'tappetino bagno + contenitori', 'tv');

-- Coerenza con le altre 6 righe 'Action' e 2 'Conad', gia' sotto Spesa.
UPDATE public.expenses SET category = 'spesa_alimentare'
WHERE category = 'altro' AND lower(description) IN (
  'action', 'conad', 'spesa dai cinesi', 'frutta');

-- Starlink era spezzato su due categorie diverse.
UPDATE public.expenses SET category = 'abbonamento'
WHERE category = 'altro' AND lower(description) = 'starlink';

-- da 'viaggi'
UPDATE public.expenses SET category = 'ristorazione'
WHERE category = 'viaggi' AND lower(description) = 'pantofla pranzo';

UPDATE public.expenses SET category = 'trasporti'
WHERE category = 'viaggi' AND lower(description) IN (
  'benzina', 'benzina marina serra', 'casello', 'parcheggio mirabilandia');

-- da 'spesa_alimentare'
UPDATE public.expenses SET category = 'trasporti'
WHERE category = 'spesa_alimentare' AND lower(description) IN ('benza', 'benzina');

UPDATE public.expenses SET category = 'ristorazione'
WHERE category = 'spesa_alimentare' AND lower(description) = 'autogrill';

-- 348,15 € di hotel erano la voce piu' grossa della categoria "Spesa".
UPDATE public.expenses SET category = 'viaggi'
WHERE category = 'spesa_alimentare' AND lower(description) = 'hotel blue ribbon';

-- da 'abbonamento'
-- La TARI e' una tassa sulla casa, non un abbonamento: da sola valeva
-- l'83% della categoria e ne falsava le statistiche.
UPDATE public.expenses SET category = 'bolletta'
WHERE category = 'abbonamento' AND lower(description) = 'tari 2026';
