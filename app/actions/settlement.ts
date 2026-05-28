'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function registerSettlement(
  notes?: string,
  expenseIds?: string[],
) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('register_settlement', {
    p_notes: notes,
    p_expense_ids: expenseIds ?? null,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/')
  revalidatePath('/spese')
  revalidatePath('/conguaglio')
  redirect('/?ok=settlement-registered')
}
