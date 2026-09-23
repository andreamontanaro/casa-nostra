import { createClient } from '@/lib/supabase/server'
import { ATTACHMENTS_BUCKET } from '@/lib/attachments'
import type { ServiceClient } from '@/lib/supabase/service'
import type { Tables } from '@/types/database'

/**
 * Client Supabase da usare per la query. Di norma si omette e viene creato il
 * client legato alla sessione dell'utente (RLS attiva). Il webhook Telegram,
 * che non ha cookie di sessione, passa esplicitamente il client service role.
 */
export type QueryClient = ServiceClient

async function client(override?: QueryClient) {
  return override ?? (await createClient())
}

export type AttachmentWithUrl = Tables<'expense_attachments'> & {
  signed_url: string | null
}

export async function getOpenBalance(db?: QueryClient) {
  const supabase = await client(db)
  const { data, error } = await supabase
    .from('v_user_open_balance')
    .select('*')

  if (error) throw error
  return data
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getRecentExpenses(limit = 5) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .select('*, paid_by_profile:profiles!expenses_paid_by_fkey(display_name)')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

export async function getAllExpenses(db?: QueryClient) {
  const supabase = await client(db)
  const { data, error } = await supabase
    .from('expenses')
    .select('*, paid_by_profile:profiles!expenses_paid_by_fkey(display_name)')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getExpenseById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .select('*, paid_by_profile:profiles!expenses_paid_by_fkey(display_name)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function getExpenseAttachments(
  expenseId: string,
  db?: QueryClient,
): Promise<AttachmentWithUrl[]> {
  const supabase = await client(db)
  const { data, error } = await supabase
    .from('expense_attachments')
    .select('*')
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: true })

  if (error) throw error
  const rows = data ?? []
  if (rows.length === 0) return []

  const { data: signed } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      60 * 60, // 1 ora
    )

  const urlByPath = new Map(
    (signed ?? []).map((s) => [s.path, s.signedUrl] as const),
  )

  return rows.map((r) => ({
    ...r,
    signed_url: urlByPath.get(r.storage_path) ?? null,
  }))
}

/** Id delle spese che hanno almeno un allegato (usato dall'assistente IA). */
export async function getExpenseIdsWithAttachments(db?: QueryClient): Promise<Set<string>> {
  const supabase = await client(db)
  const { data, error } = await supabase
    .from('expense_attachments')
    .select('expense_id')

  if (error || !data) return new Set()
  return new Set(data.map((r) => r.expense_id))
}

export async function getProfiles(db?: QueryClient) {
  const supabase = await client(db)
  const { data, error } = await supabase
    .from('profiles')
    .select('*')

  if (error) throw error
  return data
}

/** Spese aperte con le quote di entrambi, come le calcola `v_expense_shares`. */
export type OpenExpensesWithShares = Awaited<ReturnType<typeof getOpenExpensesWithShares>>

/**
 * Non dipende dall'utente, così può partire insieme a `getCurrentUser()`
 * invece di aspettarlo: le quote si filtrano poi con `withContribution`.
 */
export async function getOpenExpensesWithShares() {
  const supabase = await createClient()
  const [expensesRes, sharesRes] = await Promise.all([
    supabase.from('expenses')
      .select('*, paid_by_profile:profiles!expenses_paid_by_fkey(display_name)')
      .is('settlement_id', null)
      .order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('v_expense_shares').select('expense_id, user_id, user_share')
      .is('settlement_id', null),
  ])
  if (expensesRes.error) throw expensesRes.error
  if (sharesRes.error) throw sharesRes.error
  return { expenses: expensesRes.data ?? [], shares: sharesRes.data ?? [] }
}

export type OpenExpenseWithContribution = ReturnType<typeof withContribution>[number]

/** Contributo di ogni spesa aperta al saldo di `userId`, in centesimi esatti. */
export function withContribution({ expenses, shares }: OpenExpensesWithShares, userId: string) {
  const myShares = new Map(
    shares.filter((s) => s.user_id === userId).map((s) => [s.expense_id, s.user_share]),
  )
  return expenses.map((expense) => {
    const share = myShares.get(expense.id)
    if (share == null) throw new Error('Quota della spesa non disponibile. Aggiorna la pagina.')
    const anticipated = expense.paid_by === userId ? expense.amount : 0
    return { ...expense, my_contribution: (Math.round(anticipated * 100) - Math.round(share * 100)) / 100 }
  })
}

export async function getAllSettlements() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('settlements')
    .select(
      '*, from_user:profiles!settlements_from_user_id_fkey(display_name), to_user:profiles!settlements_to_user_id_fkey(display_name)',
    )
    .order('settled_at', { ascending: false })

  if (error) throw error
  return data
}

export type ExpenseSuggestion = {
  description: string
  category: Tables<'expenses'>['category']
  splitRule: Tables<'expenses'>['split_rule']
}

/**
 * Le descrizioni più usate, ognuna con categoria e divisione del suo ultimo
 * utilizzo: un tap sul suggerimento compila tutti e tre i campi.
 */
export async function getFrequentDescriptions(limit = 5): Promise<ExpenseSuggestion[]> {
  const supabase = await createClient()
  // Tira ~200 descrizioni recenti e raggruppa lato client: stabile, niente RPC nuova.
  const { data, error } = await supabase
    .from('expenses')
    .select('description, category, split_rule')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return []

  const byDescription = new Map<string, ExpenseSuggestion & { count: number }>()
  for (const row of data ?? []) {
    const description = (row.description ?? '').trim()
    if (!description) continue
    const seen = byDescription.get(description)
    // Le righe arrivano dalla più recente: la prima vista decide categoria e divisione.
    if (seen) seen.count += 1
    else byDescription.set(description, { description, category: row.category, splitRule: row.split_rule, count: 1 })
  }

  return [...byDescription.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ description, category, splitRule }) => ({ description, category, splitRule }))
}

/**
 * Impronta dei dati condivisi: numero di righe e ultima modifica delle tabelle
 * che le schermate mostrano. Cambia quando uno dei due (o l'assistente, o il
 * bot Telegram) aggiunge, modifica o elimina qualcosa — un conguaglio tocca
 * `updated_at` delle spese che chiude. Serve a `SharedDataRefresh` per
 * ricaricare la pagina solo quando c'è davvero qualcosa di nuovo, invece di
 * riscaricarla intera ogni trenta secondi.
 */
export async function getDataVersion(): Promise<string | null> {
  const supabase = await createClient()
  const [expenses, attachments, items, checks, profiles] = await Promise.all([
    supabase.from('expenses').select('updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false }).limit(1),
    supabase.from('expense_attachments').select('created_at', { count: 'exact' })
      .order('created_at', { ascending: false }).limit(1),
    supabase.from('shopping_items').select('updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false }).limit(1),
    supabase.from('shopping_receipt_checks').select('checked_at', { count: 'exact' })
      .order('checked_at', { ascending: false }).limit(1),
    supabase.from('profiles').select('updated_at')
      .order('updated_at', { ascending: false }).limit(1),
  ])
  if (expenses.error || attachments.error || items.error || checks.error || profiles.error) return null
  return [
    `${expenses.count}@${expenses.data[0]?.updated_at ?? ''}`,
    `${attachments.count}@${attachments.data[0]?.created_at ?? ''}`,
    `${items.count}@${items.data[0]?.updated_at ?? ''}`,
    `${checks.count}@${checks.data[0]?.checked_at ?? ''}`,
    profiles.data[0]?.updated_at ?? '',
  ].join('|')
}

// ------------------------------------------------------------
// Modulo "Lista della spesa"
// ------------------------------------------------------------

export type ShoppingItem = Tables<'shopping_items'> & {
  added_by_profile: { display_name: string } | null
  bought_by_profile: { display_name: string } | null
}
export type ShoppingLastCheck = Tables<'v_shopping_last_check'>
export type ShoppingMissingItem = Tables<'v_shopping_missing_since_last_check'>

// Literal, non concatenato: il tipo del select va inferito dalla stringa
// esatta, e una concatenazione lo degrada a `string`.
const SHOPPING_SELECT =
  '*, added_by_profile:profiles!shopping_items_added_by_fkey(display_name), bought_by_profile:profiles!shopping_items_bought_by_fkey(display_name)' as const

/**
 * Articoli ancora da comprare, dai più urgenti ai meno. L'ordinamento è
 * quello dell'enum `shopping_urgency` (bassa < media < alta), quindi
 * decrescente mette "Urgente" in cima; a parità di urgenza vince chi è in
 * lista da più tempo.
 */
export async function getOpenShoppingItems(db?: QueryClient): Promise<ShoppingItem[]> {
  const supabase = await client(db)
  const { data, error } = await supabase
    .from('shopping_items')
    .select(SHOPPING_SELECT)
    .is('bought_at', null)
    .order('urgency', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

/** Storico dei comprati, il più recente in cima. */
export async function getBoughtShoppingItems(
  limit = 20,
  db?: QueryClient,
): Promise<ShoppingItem[]> {
  const supabase = await client(db)
  const { data, error } = await supabase
    .from('shopping_items')
    .select(SHOPPING_SELECT)
    .not('bought_at', 'is', null)
    .order('bought_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

/**
 * L'ultimo scontrino controllato, o `null` se non ne è mai stato inviato uno.
 * La vista fa già l'ordinamento e il LIMIT 1: qui non si ripete.
 */
export async function getLastReceiptCheck(
  db?: QueryClient,
): Promise<ShoppingLastCheck | null> {
  const supabase = await client(db)
  const { data, error } = await supabase
    .from('v_shopping_last_check')
    .select('*')
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Cosa non è stato comprato con l'ultimo scontrino: articoli ancora aperti
 * che erano già in lista quando lo scontrino è stato controllato. Calcolato
 * dalla vista, non ricostruito confrontando date lato client.
 */
export async function getMissingSinceLastCheck(
  db?: QueryClient,
): Promise<ShoppingMissingItem[]> {
  const supabase = await client(db)
  const { data, error } = await supabase
    .from('v_shopping_missing_since_last_check')
    .select('*')
    .order('urgency', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

/** Quote del dettaglio già calcolate dal database, anche per spese saldate. */
export async function getExpenseShares(expenseId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('v_expense_shares')
    .select('user_id, user_share').eq('expense_id', expenseId)
  if (error) throw error
  return data ?? []
}
