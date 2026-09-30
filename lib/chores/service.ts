import type { QueryClient } from '@/lib/queries'
import { CHORE_NAME_MAX } from './bottle'

/**
 * Logica delle faccende, con un client Supabase esplicito come
 * `lib/shopping/service.ts`: la Server Action la chiama con la sessione, e un
 * domani l'assistente potrà chiamarla con il suo client senza riscriverla.
 *
 * I limiti veri stanno sul database: la bottiglia piena e la data futura le
 * rifiuta il trigger di `chore_entries`, chi può cancellare lo decide la RLS.
 * Qui si traducono i rifiuti in frasi, non si rifanno i controlli.
 */

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
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ')
  if (!name) return { ok: false, error: 'Scrivi che faccenda hai fatto.' }
  if (name.length > CHORE_NAME_MAX) {
    return { ok: false, error: `Il nome deve stare nella tacca: al massimo ${CHORE_NAME_MAX} caratteri.` }
  }

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
