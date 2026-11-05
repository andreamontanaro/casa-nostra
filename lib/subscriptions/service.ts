import type { QueryClient } from '@/lib/queries'
import { Constants, type Database, type Tables } from '@/types/database'
import { parseEuroInput } from '@/lib/expense-input'
import { isTelegramConfigured } from '@/lib/telegram/config'
import { sendTelegramMessage } from '@/lib/telegram/api'
import {
  subscriptionChargesMessage,
  subscriptionRemindersMessage,
  type SubscriptionNotice,
} from '@/lib/telegram/notify'
import {
  CATCH_UP_DAYS,
  INTERVAL_OPTIONS,
  addDays,
  cadenceFromDate,
  daysBetween,
  dueDatesThrough,
  isIsoDate,
  nextDueOn,
  reminderDueOn,
  romeClock,
  type Cadence,
} from './schedule'

/**
 * Logica degli abbonamenti, con un client Supabase esplicito come
 * `lib/shopping/service.ts`: le Server Action la chiamano con la sessione, il
 * cron (`/api/cron/abbonamenti`) con il service role. I vincoli veri stanno sul
 * database (importo positivo, quota personalizzata coerente, cadenze ammesse);
 * qui si danno messaggi leggibili prima del round-trip.
 */

export type Subscription = Tables<'subscriptions'>
type ExpenseCategory = Database['public']['Enums']['expense_category']
type SplitRule = Database['public']['Enums']['split_rule']

const CATEGORIES: readonly string[] = Constants.public.Enums.expense_category
const SPLIT_RULES: readonly string[] = Constants.public.Enums.split_rule

export const DESCRIPTION_MAX = 80

export function cadenceOf(sub: Pick<Subscription, 'charge_day' | 'interval_months' | 'start_month'>): Cadence {
  return { chargeDay: sub.charge_day, intervalMonths: sub.interval_months, startMonth: sub.start_month }
}

// ------------------------------------------------------------
// Inserimento e modifica
// ------------------------------------------------------------

/** I campi del form, così come arrivano (stringhe). */
export interface SubscriptionInput {
  amount: string
  description: string
  category: string
  splitRule: string
  customOtherShare: string
  paidBy: string
  /** Prossimo addebito, YYYY-MM-DD: ne derivano giorno del mese e mese di partenza. */
  nextDue: string
  intervalMonths: string
}

export type SubscriptionFieldErrors = Partial<Record<keyof SubscriptionInput, string>>

export type SubscriptionResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: SubscriptionFieldErrors }

interface CleanInput {
  amount: number
  description: string
  category: ExpenseCategory
  split_rule: SplitRule
  custom_other_share: number | null
  paid_by: string
  nextDue: string
  intervalMonths: number
}

function validate(input: SubscriptionInput, today: string): { clean: CleanInput } | { fieldErrors: SubscriptionFieldErrors } {
  const fieldErrors: SubscriptionFieldErrors = {}

  const amount = parseEuroInput(input.amount ?? '')
  if (amount === null) fieldErrors.amount = 'Inserisci un importo valido maggiore di zero.'

  const description = String(input.description ?? '').trim().replace(/\s+/g, ' ')
  if (!description) fieldErrors.description = 'Dagli un nome, es. Internet casa.'
  else if (description.length > DESCRIPTION_MAX) fieldErrors.description = `Al massimo ${DESCRIPTION_MAX} caratteri.`

  if (!CATEGORIES.includes(input.category)) fieldErrors.category = 'Scegli una categoria.'
  if (!SPLIT_RULES.includes(input.splitRule)) fieldErrors.splitRule = 'Scegli come dividerlo.'
  if (!input.paidBy) fieldErrors.paidBy = 'Indica chi paga.'

  let customOtherShare: number | null = null
  if (input.splitRule === 'custom') {
    customOtherShare = parseEuroInput(input.customOtherShare ?? '')
    if (customOtherShare === null) fieldErrors.customOtherShare = "Inserisci la quota dell'altra persona."
    else if (amount !== null && customOtherShare >= amount) {
      fieldErrors.customOtherShare = "La quota dell'altra persona deve essere inferiore all'importo."
    }
  }

  const intervalMonths = Number(input.intervalMonths)
  if (!(INTERVAL_OPTIONS as readonly number[]).includes(intervalMonths)) {
    fieldErrors.intervalMonths = 'Scegli ogni quanto arriva.'
  }

  if (!isIsoDate(input.nextDue)) fieldErrors.nextDue = 'Inserisci la data del prossimo addebito.'
  else if (input.nextDue < today) fieldErrors.nextDue = 'Il prossimo addebito non può essere nel passato.'

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }
  return {
    clean: {
      amount: amount!,
      description,
      category: input.category as ExpenseCategory,
      split_rule: input.splitRule as SplitRule,
      custom_other_share: customOtherShare,
      paid_by: input.paidBy,
      nextDue: input.nextDue,
      intervalMonths,
    },
  }
}

function scheduleColumns(nextDue: string, intervalMonths: number) {
  const cadence = cadenceFromDate(nextDue, intervalMonths)
  return { charge_day: cadence.chargeDay, interval_months: intervalMonths, start_month: cadence.startMonth }
}

export async function createSubscription(
  db: QueryClient,
  userId: string,
  input: SubscriptionInput,
  today: string,
): Promise<SubscriptionResult> {
  const checked = validate(input, today)
  if ('fieldErrors' in checked) return { ok: false, fieldErrors: checked.fieldErrors }
  const { nextDue, intervalMonths, ...expense } = checked.clean

  const { data, error } = await db
    .from('subscriptions')
    .insert({ ...expense, ...scheduleColumns(nextDue, intervalMonths), created_by: userId })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: 'Non riesco a salvare l’abbonamento. Riprova.' }
  return { ok: true, id: data.id }
}

/**
 * Modifica. La cadenza riparte dalla data indicata solo se è cambiata rispetto
 * al prossimo addebito calcolato (o è cambiata la frequenza): correggere
 * l'importo non sposta il calendario.
 */
export async function updateSubscription(
  db: QueryClient,
  id: string,
  input: SubscriptionInput,
  today: string,
): Promise<SubscriptionResult> {
  const checked = validate(input, today)
  if ('fieldErrors' in checked) return { ok: false, fieldErrors: checked.fieldErrors }
  const { nextDue, intervalMonths, ...expense } = checked.clean

  const { data: current, error: readError } = await db
    .from('subscriptions')
    .select('charge_day, interval_months, start_month')
    .eq('id', id)
    .maybeSingle()
  if (readError || !current) return { ok: false, error: 'Abbonamento non trovato.' }

  const sameSchedule =
    current.interval_months === intervalMonths && (await upcomingDueOn(db, id, cadenceOf(current), today)) === nextDue

  const { error } = await db
    .from('subscriptions')
    .update({ ...expense, ...(sameSchedule ? {} : scheduleColumns(nextDue, intervalMonths)) })
    .eq('id', id)
  if (error) return { ok: false, error: 'Non riesco a salvare le modifiche. Riprova.' }
  return { ok: true, id }
}

/**
 * Sospende o riattiva. Riattivando, la cadenza riparte dal prossimo addebito:
 * i mesi di pausa non vengono recuperati.
 */
export async function setSubscriptionActive(
  db: QueryClient,
  id: string,
  active: boolean,
  today: string,
): Promise<{ ok: boolean; error?: string }> {
  let schedule = {}
  if (active) {
    const { data: current } = await db
      .from('subscriptions')
      .select('charge_day, interval_months, start_month')
      .eq('id', id)
      .maybeSingle()
    if (!current) return { ok: false, error: 'Abbonamento non trovato.' }
    const next = await upcomingDueOn(db, id, cadenceOf(current), today)
    // Il giorno del mese resta quello scelto (il 31 resta 31 anche se il
    // prossimo addebito cade il 30).
    schedule = { start_month: cadenceFromDate(next, current.interval_months).startMonth }
  }
  const { error } = await db.from('subscriptions').update({ active, ...schedule }).eq('id', id)
  if (error) return { ok: false, error: 'Non riesco a salvare. Riprova.' }
  return { ok: true }
}

/** Elimina l'abbonamento. Le spese già registrate restano nello storico. */
export async function deleteSubscription(db: QueryClient, id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db.from('subscriptions').delete().eq('id', id)
  if (error) return { ok: false, error: 'Non riesco a eliminare l’abbonamento. Riprova.' }
  return { ok: true }
}

export async function setNotifyHour(db: QueryClient, hour: number): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { ok: false, error: 'Ora non valida.' }
  const { error } = await db.from('subscription_settings').update({ notify_hour: hour }).eq('id', 1)
  if (error) return { ok: false, error: 'Non riesco a salvare l’orario. Riprova.' }
  return { ok: true }
}

// ------------------------------------------------------------
// Lettura per la schermata
// ------------------------------------------------------------

/**
 * Il prossimo addebito ancora da registrare: oggi, se quello di oggi non è
 * ancora passato dal cron, altrimenti il successivo.
 */
async function upcomingDueOn(db: QueryClient, id: string, cadence: Cadence, today: string): Promise<string> {
  const next = nextDueOn(cadence, today)
  if (next !== today) return next
  const { data } = await db
    .from('subscription_charges')
    .select('charged_at')
    .eq('subscription_id', id)
    .eq('due_on', today)
    .maybeSingle()
  return data?.charged_at ? nextDueOn(cadence, addDays(today, 1)) : next
}

export interface SubscriptionView extends Subscription {
  /** Prossimo addebito ancora da registrare (YYYY-MM-DD). */
  nextDue: string
  /** Ultima spesa creata da questo abbonamento, se c'è ancora. */
  lastExpenseId: string | null
  lastChargedOn: string | null
}

export interface SubscriptionsOverview {
  subscriptions: SubscriptionView[]
  notifyHour: number
}

export async function getSubscriptionsOverview(db: QueryClient, today: string): Promise<SubscriptionsOverview> {
  const [subsRes, settingsRes, chargesRes] = await Promise.all([
    db.from('subscriptions').select('*').order('active', { ascending: false }).order('description'),
    db.from('subscription_settings').select('notify_hour').eq('id', 1).maybeSingle(),
    db
      .from('subscription_charges')
      .select('subscription_id, due_on, charged_at, expense_id')
      .not('charged_at', 'is', null)
      .order('due_on', { ascending: false })
      .limit(200),
  ])
  if (subsRes.error) throw subsRes.error

  const charges = chargesRes.data ?? []
  const subscriptions = (subsRes.data ?? []).map((sub): SubscriptionView => {
    const cadence = cadenceOf(sub)
    const last = charges.find((c) => c.subscription_id === sub.id)
    let nextDue = nextDueOn(cadence, today)
    if (nextDue === today && last?.due_on === today) nextDue = nextDueOn(cadence, addDays(today, 1))
    return { ...sub, nextDue, lastExpenseId: last?.expense_id ?? null, lastChargedOn: last?.due_on ?? null }
  })
  // Prima gli attivi, dal prossimo addebito più vicino.
  subscriptions.sort((a, b) => Number(b.active) - Number(a.active) || a.nextDue.localeCompare(b.nextDue))

  return { subscriptions, notifyHour: settingsRes.data?.notify_hour ?? 9 }
}

// ------------------------------------------------------------
// Il cron
// ------------------------------------------------------------

export type JobsResult =
  | { status: 'early'; today: string; hour: number; notifyHour: number }
  | { status: 'ok'; today: string; charged: number; reminded: number; failed: number }

type ChargeColumn = 'charged_at' | 'reminded_at'

/**
 * Prende in carico un addebito per un evento (spesa o promemoria). Prima si
 * assicura che la riga esista, poi la marca solo se la colonna è ancora vuota:
 * delle due esecuzioni in parallelo una sola vede la riga aggiornata.
 */
async function claim(db: QueryClient, subscriptionId: string, dueOn: string, column: ChargeColumn): Promise<boolean> {
  const { error: upsertError } = await db
    .from('subscription_charges')
    .upsert({ subscription_id: subscriptionId, due_on: dueOn }, {
      onConflict: 'subscription_id,due_on',
      ignoreDuplicates: true,
    })
  if (upsertError) throw upsertError

  const now = new Date().toISOString()
  const { data, error } = await db
    .from('subscription_charges')
    .update(column === 'charged_at' ? { charged_at: now } : { reminded_at: now })
    .eq('subscription_id', subscriptionId)
    .eq('due_on', dueOn)
    .is(column, null)
    .select('id')
  if (error) throw error
  return (data ?? []).length === 1
}

async function release(db: QueryClient, subscriptionId: string, dueOn: string, column: ChargeColumn) {
  await db
    .from('subscription_charges')
    .update(column === 'charged_at' ? { charged_at: null } : { reminded_at: null })
    .eq('subscription_id', subscriptionId)
    .eq('due_on', dueOn)
}

/**
 * Il lavoro di un'ora: dall'ora scelta in poi registra le spese degli addebiti
 * di oggi (e di quelli rimasti indietro, fino a `CATCH_UP_DAYS`) e manda i
 * promemoria dei prossimi 3 giorni. Idempotente: si può chiamare ogni ora, o
 * due volte in parallelo, senza doppioni. Telegram è facoltativo: senza, le
 * spese si registrano comunque e i promemoria non partono.
 */
export async function runSubscriptionJobs(db: QueryClient, now = new Date()): Promise<JobsResult> {
  const { date: today, hour } = romeClock(now)

  const { data: settings, error: settingsError } = await db
    .from('subscription_settings')
    .select('notify_hour')
    .eq('id', 1)
    .maybeSingle()
  if (settingsError) throw settingsError
  const notifyHour = settings?.notify_hour ?? 9
  if (hour < notifyHour) return { status: 'early', today, hour, notifyHour }

  const [subsRes, chargesRes, profilesRes] = await Promise.all([
    db.from('subscriptions').select('*').eq('active', true),
    db
      .from('subscription_charges')
      .select('subscription_id, due_on, charged_at, reminded_at')
      .gte('due_on', addDays(today, -CATCH_UP_DAYS)),
    db.from('profiles').select('id, display_name'),
  ])
  if (subsRes.error) throw subsRes.error
  if (chargesRes.error) throw chargesRes.error

  const known = new Map((chargesRes.data ?? []).map((c) => [`${c.subscription_id}|${c.due_on}`, c]))
  const profiles = profilesRes.data ?? []
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.display_name ?? 'Qualcuno'
  const otherOf = (id: string) => profiles.find((p) => p.id !== id)?.display_name

  const notice = (sub: Subscription, dueOn: string, expenseId?: string): SubscriptionNotice => ({
    expenseId,
    amount: Number(sub.amount),
    description: sub.description,
    category: sub.category,
    splitRule: sub.split_rule,
    payerName: nameOf(sub.paid_by),
    chargedToName: otherOf(sub.paid_by),
    dueOn,
  })

  const charged: SubscriptionNotice[] = []
  const reminders: (SubscriptionNotice & { daysLeft: number })[] = []
  let failed = 0
  const telegram = isTelegramConfigured()

  for (const sub of subsRes.data ?? []) {
    const cadence = cadenceOf(sub)

    for (const dueOn of dueDatesThrough(cadence, today)) {
      if (known.get(`${sub.id}|${dueOn}`)?.charged_at) continue
      try {
        if (!(await claim(db, sub.id, dueOn, 'charged_at'))) continue
        const { data: expense, error } = await db
          .from('expenses')
          .insert({
            amount: sub.amount,
            description: sub.description,
            category: sub.category,
            split_rule: sub.split_rule,
            custom_other_share: sub.custom_other_share,
            paid_by: sub.paid_by,
            created_by: sub.paid_by,
            expense_date: dueOn,
          })
          .select('id')
          .single()
        if (error || !expense) {
          // Si libera la presa in carico: ci riprova l'esecuzione dell'ora dopo.
          await release(db, sub.id, dueOn, 'charged_at')
          throw error ?? new Error('insert senza risultato')
        }
        await db
          .from('subscription_charges')
          .update({ expense_id: expense.id })
          .eq('subscription_id', sub.id)
          .eq('due_on', dueOn)
        charged.push(notice(sub, dueOn, expense.id))
      } catch (e) {
        failed++
        console.error('[abbonamenti] addebito non registrato:', sub.id, dueOn, e)
      }
    }

    if (!telegram) continue
    const remindOn = reminderDueOn(cadence, today)
    if (!remindOn || known.get(`${sub.id}|${remindOn}`)?.reminded_at) continue
    try {
      if (await claim(db, sub.id, remindOn, 'reminded_at')) {
        reminders.push({ ...notice(sub, remindOn), daysLeft: daysBetween(today, remindOn) })
      }
    } catch (e) {
      failed++
      console.error('[abbonamenti] promemoria non preso in carico:', sub.id, remindOn, e)
    }
  }

  if (telegram && charged.length > 0) {
    const { data: balance } = await db.from('v_user_open_balance').select('*')
    const sent = await sendTelegramMessage(subscriptionChargesMessage(charged, balance ?? []))
    if (!sent) console.error('[abbonamenti] notifica degli addebiti non consegnata')
  }
  if (reminders.length > 0) {
    reminders.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    const sent = await sendTelegramMessage(subscriptionRemindersMessage(reminders))
    if (!sent) console.error('[abbonamenti] promemoria non consegnato')
  }

  return { status: 'ok', today, charged: charged.length, reminded: reminders.length, failed }
}
