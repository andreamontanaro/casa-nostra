'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  acceptChoreHint,
  addChoreEntry,
  addChoreHint,
  addChorePreset,
  deleteChoreEntry,
  deleteChorePreset,
  dismissRecentChore,
  removeChoreHint,
  restoreRecentChore,
  type ChoreEntryInput,
} from '@/lib/chores/service'

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

/** Crea un'azione nuova in un ambito, per tutti e due. */
export async function addChorePresetAction(input: {
  name: string
  groupId: string
}): Promise<{ error?: string; duplicate?: boolean; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const result = await addChorePreset(supabase, user.id, input)
  if (!result.ok) return { error: result.error, duplicate: result.duplicate }

  revalidateChores()
  return { id: result.id }
}

export async function deleteChorePresetAction(id: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const result = await deleteChorePreset(supabase, id)
  if (!result.ok) return { error: result.error }

  revalidateChores()
  return { ok: true }
}

/** Toglie un nome dai "Recenti": le faccende già segnate restano. */
export async function dismissRecentChoreAction(name: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const result = await dismissRecentChore(supabase, user.id, name)
  if (!result.ok) return { error: result.error }

  revalidateChores()
  return { ok: true }
}

export async function restoreRecentChoreAction(name: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const result = await restoreRecentChore(supabase, name)
  if (!result.ok) return { error: result.error }

  revalidateChores()
  return { ok: true }
}

/** Suggerisce una faccenda all'altra persona. Nessuna notifica: la vede aprendo l'app. */
export async function addChoreHintAction(input: {
  name: string
  forUser: string
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const result = await addChoreHint(supabase, user.id, input)
  if (!result.ok) return { error: result.error }

  revalidateChores()
  return { id: result.id }
}

/** Il suggerimento ricevuto diventa una faccenda. Ritorna l'id della faccenda, per "Annulla". */
export async function acceptChoreHintAction(hintId: string): Promise<{ error?: string; entryId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const result = await acceptChoreHint(supabase, hintId)
  if (!result.ok) return { error: result.error }

  revalidateChores()
  return { entryId: result.entryId }
}

export async function removeChoreHintAction(hintId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const result = await removeChoreHint(supabase, hintId)
  if (!result.ok) return { error: result.error }

  revalidateChores()
  return { ok: true }
}
