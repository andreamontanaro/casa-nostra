-- ============================================================
-- Casa Nostra - Anticipare l'addebito di un abbonamento
-- ------------------------------------------------------------
-- Richiesta del 5 novembre 2026: quando un abbonamento ha
-- l'addebito entro 4 giorni, si puo' "anticiparlo". La spesa entra
-- subito nel saldo e quell'addebito risulta fatto: il cron non la
-- ricrea il giorno dell'addebito e non manda il promemoria. La data
-- della spesa la sceglie chi anticipa, fra oggi e il giorno
-- dell'addebito. La spesa resta aperta come le altre: si chiude con
-- il conguaglio normale.
--
-- Una RPC perche' spesa e registro devono nascere insieme (o niente),
-- come register_settlement. SECURITY DEFINER perche' dall'app
-- subscription_charges si legge soltanto: lo scrivono il cron e
-- questa funzione, che controlla da se' l'utente.
--
-- Che p_due_on sia davvero il prossimo addebito dell'abbonamento lo
-- verifica lib/subscriptions/service.ts (le date le calcola
-- lib/subscriptions/schedule.ts); qui si garantisce che non nasca un
-- doppione e che le date abbiano senso.
--
-- Da eseguire nell'editor SQL di Supabase PRIMA di pubblicare il
-- codice. Replicata nella sezione 16 di docs/casa_nostra_schema.sql.
-- ============================================================

CREATE FUNCTION public.anticipate_subscription_charge(
  p_subscription_id uuid,
  p_due_on          date,
  p_expense_date    date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today      date := (now() AT TIME ZONE 'Europe/Rome')::date;
  v_sub        public.subscriptions%ROWTYPE;
  v_charge_id  uuid;
  v_expense_id uuid;
BEGIN
  IF NOT public.is_authorized_user() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_due_on < v_today OR p_expense_date NOT IN (v_today, p_due_on) THEN
    RAISE EXCEPTION 'invalid_dates' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription_not_active' USING ERRCODE = 'P0001';
  END IF;

  -- Stessa presa in carico del cron: una sola delle due la vince.
  INSERT INTO public.subscription_charges (subscription_id, due_on)
  VALUES (p_subscription_id, p_due_on)
  ON CONFLICT (subscription_id, due_on) DO NOTHING;

  UPDATE public.subscription_charges
     SET charged_at = now()
   WHERE subscription_id = p_subscription_id
     AND due_on = p_due_on
     AND charged_at IS NULL
  RETURNING id INTO v_charge_id;

  IF v_charge_id IS NULL THEN
    RAISE EXCEPTION 'already_charged' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.expenses (
    amount, description, category, split_rule, custom_other_share,
    paid_by, expense_date, created_by
  ) VALUES (
    v_sub.amount, v_sub.description, v_sub.category, v_sub.split_rule, v_sub.custom_other_share,
    v_sub.paid_by, p_expense_date, auth.uid()
  )
  RETURNING id INTO v_expense_id;

  UPDATE public.subscription_charges SET expense_id = v_expense_id WHERE id = v_charge_id;

  RETURN v_expense_id;
END;
$$;

COMMENT ON FUNCTION public.anticipate_subscription_charge IS
  'Anticipa l''addebito p_due_on di un abbonamento: crea la spesa (data p_expense_date, oggi o il giorno dell''addebito) e lo segna come fatto, in un''unica transazione. Ritorna l''id della spesa.';

REVOKE ALL ON FUNCTION public.anticipate_subscription_charge FROM public, anon;
GRANT EXECUTE ON FUNCTION public.anticipate_subscription_charge TO authenticated;
