'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Database } from '@/types/database'

type ExpenseCategory = Database['public']['Enums']['expense_category']
type SplitRule = Database['public']['Enums']['split_rule']

export type ExpenseFormState = {
  error?: string
  fieldErrors?: Partial<Record<string, string>>
}

export async function createExpense(
  _prev: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const rawAmount = formData.get('amount') as string
  const description = (formData.get('description') as string).trim()
  const category = formData.get('category') as ExpenseCategory
  const splitRule = formData.get('split_rule') as SplitRule
  const paidBy = formData.get('paid_by') as string
  const expenseDate = formData.get('expense_date') as string

  const fieldErrors: Record<string, string> = {}

  const amount = parseFloat(rawAmount.replace(',', '.'))
  if (!rawAmount || isNaN(amount) || amount <= 0) {
    fieldErrors.amount = 'Inserisci un importo valido maggiore di zero.'
  }
  if (!description) fieldErrors.description = 'La descrizione è obbligatoria.'
  if (!category) fieldErrors.category = 'Scegli una categoria.'
  if (!splitRule) fieldErrors.split_rule = 'Scegli la regola di divisione.'
  if (!paidBy) fieldErrors.paid_by = 'Indica chi ha pagato.'
  if (!expenseDate) fieldErrors.expense_date = 'Inserisci la data.'

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const { error } = await supabase.from('expenses').insert({
    amount,
    description,
    category,
    split_rule: splitRule,
    paid_by: paidBy,
    expense_date: expenseDate,
    created_by: user.id,
  })

  if (error) return { error: 'Errore durante il salvataggio. Riprova.' }

  revalidatePath('/')
  revalidatePath('/spese')
  redirect('/')
}

export async function updateExpense(
  id: string,
  _prev: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const rawAmount = formData.get('amount') as string
  const description = (formData.get('description') as string).trim()
  const category = formData.get('category') as ExpenseCategory
  const splitRule = formData.get('split_rule') as SplitRule
  const paidBy = formData.get('paid_by') as string
  const expenseDate = formData.get('expense_date') as string

  const fieldErrors: Record<string, string> = {}

  const amount = parseFloat(rawAmount.replace(',', '.'))
  if (!rawAmount || isNaN(amount) || amount <= 0) {
    fieldErrors.amount = 'Inserisci un importo valido maggiore di zero.'
  }
  if (!description) fieldErrors.description = 'La descrizione è obbligatoria.'

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const { error } = await supabase
    .from('expenses')
    .update({ amount, description, category, split_rule: splitRule, paid_by: paidBy, expense_date: expenseDate })
    .eq('id', id)

  if (error) return { error: 'Errore durante il salvataggio. Riprova.' }

  revalidatePath('/')
  revalidatePath('/spese')
  revalidatePath(`/spese/${id}`)
  redirect(`/spese/${id}`)
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw new Error('Errore durante l\'eliminazione.')

  revalidatePath('/')
  revalidatePath('/spese')
  redirect('/spese')
}
