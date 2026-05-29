'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Database } from '@/types/database'
import { ATTACHMENTS_BUCKET } from '@/lib/attachments'

type ExpenseCategory = Database['public']['Enums']['expense_category']
type SplitRule = Database['public']['Enums']['split_rule']

export type ExpenseFormState = {
  error?: string
  fieldErrors?: Partial<Record<string, string>>
  ok?: boolean
  expenseId?: string
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
  const rawCustomOtherShare = formData.get('custom_other_share') as string

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

  let customOtherShare: number | null = null
  if (splitRule === 'custom') {
    customOtherShare = parseFloat((rawCustomOtherShare ?? '').replace(',', '.'))
    if (isNaN(customOtherShare) || customOtherShare <= 0) {
      fieldErrors.custom_other_share = "Inserisci la quota dell'altra persona."
    } else if (!isNaN(amount) && customOtherShare >= amount) {
      fieldErrors.custom_other_share = "La quota dell'altra persona deve essere inferiore all'importo totale."
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const hasAttachments = formData.get('has_attachments') === '1'

  const { data: inserted, error } = await supabase
    .from('expenses')
    .insert({
      amount,
      description,
      category,
      split_rule: splitRule,
      paid_by: paidBy,
      expense_date: expenseDate,
      created_by: user.id,
      custom_other_share: customOtherShare,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return { error: 'Errore durante il salvataggio. Riprova.' }
  }

  revalidatePath('/')
  revalidatePath('/spese')

  // Con allegati: niente redirect, il client carica i file e poi naviga.
  if (hasAttachments) {
    return { ok: true, expenseId: inserted.id }
  }

  redirect('/?ok=expense-created')
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
  const rawCustomOtherShare = formData.get('custom_other_share') as string

  const fieldErrors: Record<string, string> = {}

  const amount = parseFloat(rawAmount.replace(',', '.'))
  if (!rawAmount || isNaN(amount) || amount <= 0) {
    fieldErrors.amount = 'Inserisci un importo valido maggiore di zero.'
  }
  if (!description) fieldErrors.description = 'La descrizione è obbligatoria.'

  let customOtherShare: number | null = null
  if (splitRule === 'custom') {
    customOtherShare = parseFloat((rawCustomOtherShare ?? '').replace(',', '.'))
    if (isNaN(customOtherShare) || customOtherShare <= 0) {
      fieldErrors.custom_other_share = "Inserisci la quota dell'altra persona."
    } else if (!isNaN(amount) && customOtherShare >= amount) {
      fieldErrors.custom_other_share = "La quota dell'altra persona deve essere inferiore all'importo totale."
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const { error } = await supabase
    .from('expenses')
    .update({
      amount,
      description,
      category,
      split_rule: splitRule,
      paid_by: paidBy,
      expense_date: expenseDate,
      custom_other_share: customOtherShare,
    })
    .eq('id', id)

  if (error) return { error: 'Errore durante il salvataggio. Riprova.' }

  revalidatePath('/')
  revalidatePath('/spese')
  revalidatePath(`/spese/${id}`)
  redirect('/spese?ok=expense-updated')
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()

  // La FK ON DELETE CASCADE rimuove le righe expense_attachments, ma non i
  // file su Storage: vanno rimossi a mano prima di eliminare la spesa.
  const { data: attachments } = await supabase
    .from('expense_attachments')
    .select('storage_path')
    .eq('expense_id', id)
  if (attachments && attachments.length > 0) {
    await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .remove(attachments.map((a) => a.storage_path))
  }

  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw new Error("Errore durante l'eliminazione.")

  revalidatePath('/')
  revalidatePath('/spese')
  redirect('/spese?ok=expense-deleted')
}
