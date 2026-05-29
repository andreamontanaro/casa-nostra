import { createClient } from '@/lib/supabase/server'
import { ATTACHMENTS_BUCKET } from '@/lib/attachments'
import type { Tables } from '@/types/database'

export type AttachmentWithUrl = Tables<'expense_attachments'> & {
  signed_url: string | null
}

export async function getOpenBalance() {
  const supabase = await createClient()
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

export async function getAllExpenses() {
  const supabase = await createClient()
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
): Promise<AttachmentWithUrl[]> {
  const supabase = await createClient()
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

export async function getProfiles() {
  const supabase = await createClient()
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

  const [profileRes, expensesRes] = await Promise.all([
    supabase.from('profiles').select('higher_income').eq('id', userId).single(),
    supabase
      .from('expenses')
      .select('*, paid_by_profile:profiles!expenses_paid_by_fkey(display_name)')
      .is('settlement_id', null)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (profileRes.error) throw profileRes.error
  if (expensesRes.error) throw expensesRes.error

  const higherIncome = profileRes.data.higher_income

  return (expensesRes.data ?? []).map((e) => {
    let myShare: number
    if (e.split_rule === 'fifty_fifty') {
      myShare = e.amount * 0.5
    } else if (e.split_rule === 'sixty_forty') {
      myShare = e.amount * (higherIncome ? 0.6 : 0.4)
    } else {
      const otherShare = e.custom_other_share ?? 0
      myShare = e.paid_by === userId ? e.amount - otherShare : otherShare
    }
    const anticipated = e.paid_by === userId ? e.amount : 0
    const myContribution = Math.round((anticipated - myShare) * 100) / 100
    return { ...e, my_contribution: myContribution }
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
