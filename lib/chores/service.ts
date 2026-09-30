import type { QueryClient } from '@/lib/queries'
import { CHORE_NAME_MAX } from './bottle'
import { CHORE_PRESET_GROUPS, recentKey } from './presets'

/**
 * Logica delle faccende, con un client Supabase esplicito come
 * `lib/shopping/service.ts`: la Server Action la chiama con la sessione, e un
 * domani l'assistente potrà chiamarla con il suo client senza riscriverla.
 *
 * I limiti veri stanno sul database: la bottiglia piena e la data futura le
 * rifiuta il trigger di `chore_entries`, chi può cancellare lo decide la RLS.
 * Qui si traducono i rifiuti in frasi, non si rifanno i controlli.
 */

const UNIQUE_VIOLATION = '23505'
const TOO_LONG = `Il nome deve stare nella tacca: al massimo ${CHORE_NAME_MAX} caratteri.`

function cleanName(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export interface ChoreEntryInput {
  name: string
  doneBy: string
  /** YYYY-MM-DD nel fuso della casa; se manca è oggi (default del DB). */
  doneOn?: string
}

export type AddChoreResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string; full?: boolean }

export async function addChoreEntry(
  db: QueryClient,
  userId: string,
  input: ChoreEntryInput,
): Promise<AddChoreResult> {
  const name = cleanName(input.name)
  if (!name) return { ok: false, error: 'Scrivi che faccenda hai fatto.' }
  if (name.length > CHORE_NAME_MAX) return { ok: false, error: TOO_LONG }

  const { data, error } = await db
    .from('chore_entries')
    .insert({
      name,
      done_by: input.doneBy,
      created_by: userId,
      ...(input.doneOn ? { done_on: input.doneOn } : {}),
    })
    .select('id, name')
    .single()

  if (error) {
    if (error.message.includes('chore_bottle_full')) {
      return { ok: false, error: 'La bottiglia di quel giorno è già piena.', full: true }
    }
    if (error.message.includes('chore_future_date')) {
      return { ok: false, error: 'Una faccenda non si può segnare nel futuro.' }
    }
    return { ok: false, error: 'Errore durante il salvataggio. Riprova.' }
  }

  return { ok: true, id: data.id, name: data.name }
}

/**
 * Elimina una faccenda. La RLS lascia cancellare solo quello che si è fatto
 * o segnato: una riga dell'altro non dà errore, semplicemente non sparisce,
 * quindi si conta cosa è stato davvero eliminato.
 */
export async function deleteChoreEntry(
  db: QueryClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await db.from('chore_entries').delete().eq('id', id).select('id')
  if (error) return { ok: false, error: 'Errore durante l\'eliminazione. Riprova.' }
  if (!data?.length) {
    return { ok: false, error: 'Puoi eliminare solo le faccende che hai fatto o segnato tu.' }
  }
  return { ok: true }
}

// ------------------------------------------------------------
// Azioni create da voi
// ------------------------------------------------------------

export type AddPresetResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string; duplicate?: boolean }

/** Aggiunge un'azione a un ambito. Il doppione lo blocca l'indice unico sul database. */
export async function addChorePreset(
  db: QueryClient,
  userId: string,
  input: { name: string; groupId: string },
): Promise<AddPresetResult> {
  const name = cleanName(input.name)
  if (!name) return { ok: false, error: 'Scrivi il nome dell’azione.' }
  if (name.length > CHORE_NAME_MAX) return { ok: false, error: TOO_LONG }
  if (!CHORE_PRESET_GROUPS.some((g) => g.id === input.groupId)) {
    return { ok: false, error: 'Scegli un ambito.' }
  }

  const { data, error } = await db
    .from('chore_presets')
    .insert({ name, group_id: input.groupId, created_by: userId })
    .select('id, name')
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: `"${name}" c’è già tra le azioni.`, duplicate: true }
    }
    return { ok: false, error: 'Errore durante il salvataggio. Riprova.' }
  }
  return { ok: true, id: data.id, name: data.name }
}

/** Toglie un'azione creata da voi. Le faccende già segnate con quel nome restano. */
export async function deleteChorePreset(
  db: QueryClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db.from('chore_presets').delete().eq('id', id)
  if (error) return { ok: false, error: 'Errore durante l\'eliminazione. Riprova.' }
  return { ok: true }
}

// ------------------------------------------------------------
// Recenti
// ------------------------------------------------------------

/**
 * Toglie un nome dai "Recenti". Non cancella nessuna faccenda: lo nasconde
 * finché non viene segnato di nuovo. Toglierlo due volte aggiorna solo l'ora.
 */
export async function dismissRecentChore(
  db: QueryClient,
  userId: string,
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = recentKey(name)
  if (!key || key.length > CHORE_NAME_MAX) return { ok: false, error: 'Nome non valido.' }
  const { error } = await db
    .from('chore_recent_dismissals')
    .upsert({ name_key: key, dismissed_by: userId, dismissed_at: new Date().toISOString() })
  if (error) return { ok: false, error: 'Non riesco a toglierla dai recenti. Riprova.' }
  return { ok: true }
}

/** Rimette un nome tra i recenti (il bottone "Annulla" del toast). */
export async function restoreRecentChore(
  db: QueryClient,
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db.from('chore_recent_dismissals').delete().eq('name_key', recentKey(name))
  if (error) return { ok: false, error: 'Non riesco a rimetterla tra i recenti. Riprova.' }
  return { ok: true }
}

// ------------------------------------------------------------
// Suggerimenti all'altra persona
// ------------------------------------------------------------

export type AddHintResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string; full?: boolean }

/**
 * Suggerisce una faccenda all'altra persona, per oggi. Occupa una tacca
 * libera della sua bottiglia: se non ce ne sono, il trigger lo rifiuta.
 */
export async function addChoreHint(
  db: QueryClient,
  userId: string,
  input: { name: string; forUser: string },
): Promise<AddHintResult> {
  const name = cleanName(input.name)
  if (!name) return { ok: false, error: 'Scrivi che faccenda suggerire.' }
  if (name.length > CHORE_NAME_MAX) return { ok: false, error: TOO_LONG }
  if (input.forUser === userId) return { ok: false, error: 'Un suggerimento va all’altra persona.' }

  const { data, error } = await db
    .from('chore_hints')
    .insert({ name, for_user: input.forUser, from_user: userId })
    .select('id, name')
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { ok: false, error: `"${name}" è già suggerita per oggi.` }
    if (error.message.includes('chore_bottle_full')) {
      return { ok: false, error: 'La bottiglia di oggi è già piena, suggerimenti compresi.', full: true }
    }
    return { ok: false, error: 'Errore durante l’invio. Riprova.' }
  }
  return { ok: true, id: data.id, name: data.name }
}

/**
 * Conferma un suggerimento ricevuto: la RPC lo toglie e segna la faccenda
 * nella stessa transazione, quindi o succedono tutte e due o nessuna.
 */
export async function acceptChoreHint(
  db: QueryClient,
  hintId: string,
): Promise<{ ok: true; entryId: string } | { ok: false; error: string }> {
  const { data, error } = await db.rpc('accept_chore_hint', { p_hint_id: hintId })
  if (error) {
    if (error.message.includes('chore_bottle_full')) {
      return { ok: false, error: 'La bottiglia di oggi è già piena.' }
    }
    if (error.message.includes('chore_hint_not_found')) {
      return { ok: false, error: 'Questo suggerimento non c’è più: forse è stato ritirato.' }
    }
    return { ok: false, error: 'Errore durante il salvataggio. Riprova.' }
  }
  return { ok: true, entryId: data }
}

/** Toglie un suggerimento: lo ritira chi l'ha mandato, lo scarta chi l'ha ricevuto. */
export async function removeChoreHint(
  db: QueryClient,
  hintId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db.from('chore_hints').delete().eq('id', hintId)
  if (error) return { ok: false, error: 'Errore durante l’eliminazione. Riprova.' }
  return { ok: true }
}
