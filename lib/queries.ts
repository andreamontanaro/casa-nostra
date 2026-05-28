import { createClient } from '@/lib/supabase/server'

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

export async function getProfiles() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')

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
