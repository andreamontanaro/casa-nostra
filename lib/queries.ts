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

export type OpenExpenseWithContribution = Awaited<
  ReturnType<typeof getOpenExpensesWithContribution>
>[number]

export async function getOpenExpensesWithContribution(userId: string) {
  const supabase = await createClient()
  const [expensesRes, sharesRes] = await Promise.all([
    supabase.from('expenses')
      .select('*, paid_by_profile:profiles!expenses_paid_by_fkey(display_name)')
      .is('settlement_id', null)
      .order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('v_expense_shares').select('expense_id, user_share')
      .eq('user_id', userId).is('settlement_id', null),
  ])
  if (expensesRes.error) throw expensesRes.error
  if (sharesRes.error) throw sharesRes.error
  const shares = new Map((sharesRes.data ?? []).map((s) => [s.expense_id, s.user_share]))
  return (expensesRes.data ?? []).map((expense) => {
    const share = shares.get(expense.id)
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

export async function getFrequentDescriptions(limit = 5): Promise<string[]> {
  const supabase = await createClient()
  // Tira ~200 descrizioni recenti e raggruppa lato client: stabile, niente RPC nuova.
  const { data, error } = await supabase
    .from('expenses')
    .select('description')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return []

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const d = (row.description ?? '').trim()
    if (!d) continue
    counts.set(d, (counts.get(d) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([d]) => d)
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
