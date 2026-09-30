'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { addChoreEntry, deleteChoreEntry, type ChoreEntryInput } from '@/lib/chores/service'

// Niente notifiche Telegram, per scelta: le faccende servono a tenere traccia,
// non a mettere pressione. Non aggiungerle qui.

export type ActionState = { error?: string; ok?: boolean }

function revalidateChores() {
  revalidatePath('/faccende')
}

export async function addChoreAction(
  input: ChoreEntryInput,
): Promise<{ error?: string; full?: boolean; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const result = await addChoreEntry(supabase, user.id, input)
  if (!result.ok) return { error: result.error, full: result.full }

  revalidateChores()
  return { id: result.id }
}

export async function deleteChoreAction(id: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const result = await deleteChoreEntry(supabase, id)
  if (!result.ok) return { error: result.error }

  revalidateChores()
  return { ok: true }
}
