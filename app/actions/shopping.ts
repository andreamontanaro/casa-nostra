'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { MODEL } from '@/lib/assistant/run'
import {
  addShoppingItem,
  clearBoughtShoppingItems,
  deleteShoppingItem,
  markShoppingItemsBought,
  readQuickItemInput,
  restoreShoppingItem,
  runReceiptCheck,
  updateShoppingItem,
  type QuickItemReading,
  type ReceiptCheckResult,
  type ShoppingItemInput,
} from '@/lib/shopping/service'
import { RECEIPTS_BUCKET } from '@/lib/shopping/receipts'
import { notifyTelegram, receiptCheckMessage, urgentItemAddedMessage } from '@/lib/telegram/notify'

export type ActionState = { error?: string; ok?: boolean }

function revalidateShopping() {
  revalidatePath('/lista')
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function addItemAction(
  input: ShoppingItemInput,
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const result = await addShoppingItem(supabase, user.id, input)
  if (!result.ok) return { error: result.error }

  revalidateShopping()

  // Nel gruppo finisce solo ciò che serve davvero subito: notificare ogni
  // "carta forno" trasformerebbe la chat in un rumore di fondo che si impara
  // a ignorare, e con esso le notifiche delle spese.
  if (result.urgency === 'alta') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
    notifyTelegram(
      urgentItemAddedMessage(profile?.display_name ?? 'Qualcuno', result.name, input.quantity ?? null),
    )
  }

  return { id: result.id }
}

/**
 * Aggiunta dalla barra rapida: nel campo si scrive una riga sola ("x2 mele")
 * e i campi che il form chiederebbe uno per uno — nome, quantità, categoria —
 * li ricava il modello. È l'unico posto dove serve: nel form li compila
 * l'utente, nell'assistente li ricava già lui interpretando la frase.
 *
 * L'interpretazione non è mai un ostacolo: se Gemini non è configurato, è
 * lento o sbaglia, `readQuickItemInput` restituisce la riga così com'è
 * scritta, senza quantità e in "cibo", e l'articolo entra comunque. Quello
 * che è stato letto torna al chiamante per dirlo nel toast: una scelta fatta
 * da altri va mostrata, e si corregge con un tap sulla riga.
 */
export async function addQuickItemAction(
  text: string,
): Promise<{ error?: string; id?: string; reading?: QuickItemReading }> {
  const reading = await readQuickItemInput({
    text,
    apiKey: process.env.GEMINI_API_KEY,
    model: MODEL,
  })

  const result = await addItemAction({
    name: reading.name,
    quantity: reading.quantity,
    category: reading.category,
    urgency: 'media',
  })
  if (result.error) return { error: result.error }

  return { id: result.id, reading }
}

export async function updateItemAction(
  id: string,
  input: ShoppingItemInput,
): Promise<ActionState> {
  const supabase = await createClient()
  if (!(await currentUserId())) return { error: 'Non autenticato.' }

  const result = await updateShoppingItem(supabase, id, input)
  if (!result.ok) return { error: result.error }

  revalidateShopping()
  return { ok: true }
}

/** Spunta un articolo dalla lista (tap sul checkbox). */
export async function markBoughtAction(id: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const result = await markShoppingItemsBought(supabase, user.id, [id], 'app')
  if (!result.ok) return { error: result.error }

  revalidateShopping()
  return { ok: true }
}

/** Rimette in lista un articolo spuntato (bottone "Annulla" del toast). */
export async function restoreItemAction(id: string): Promise<ActionState> {
  const supabase = await createClient()
  if (!(await currentUserId())) return { error: 'Non autenticato.' }

  const result = await restoreShoppingItem(supabase, id)
  if (!result.ok) return { error: result.error }

  revalidateShopping()
  return { ok: true }
}

export async function deleteItemAction(id: string): Promise<ActionState> {
  const supabase = await createClient()
  if (!(await currentUserId())) return { error: 'Non autenticato.' }

  const result = await deleteShoppingItem(supabase, id)
  if (!result.ok) return { error: result.error }

  revalidateShopping()
  return { ok: true }
}

export async function clearBoughtAction(): Promise<{ error?: string; count?: number }> {
  const supabase = await createClient()
  if (!(await currentUserId())) return { error: 'Non autenticato.' }

  const result = await clearBoughtShoppingItems(supabase)
  if (!result.ok) return { error: result.error }

  revalidateShopping()
  return { count: result.count }
}

/**
 * Controllo scontrino a partire da un file già caricato dal browser nel
 * bucket privato. Il file passa dal client allo Storage e non dalla Server
 * Action perché il body di una Server Action è limitato a 1 MB: la foto di
 * uno scontrino lo supera quasi sempre.
 */
export async function checkReceiptAction(params: {
  storagePath: string
  fileName: string
  mimeType: string
}): Promise<ReceiptCheckResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autenticato.' }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'Il controllo scontrini non è disponibile al momento. Puoi continuare a usare la lista.' }
  }

  const { data: blob, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .download(params.storagePath)

  // Il file caricato dal browser è solo il veicolo: il controllo ne salva una
  // copia sua (con il percorso registrato sul controllo), quindi questo si
  // rimuove comunque, sia che il controllo riesca sia che fallisca.
  const cleanup = () => supabase.storage.from(RECEIPTS_BUCKET).remove([params.storagePath])

  if (error || !blob) {
    await cleanup()
    return { ok: false, error: 'Non trovo la foto caricata. Riprova.' }
  }

  const result = await runReceiptCheck({
    db: supabase,
    userId: user.id,
    apiKey,
    model: MODEL,
    source: 'app',
    fileName: params.fileName,
    mimeType: params.mimeType,
    bytes: new Uint8Array(await blob.arrayBuffer()),
  })

  await cleanup()

  if (result.ok) {
    revalidateShopping()
    notifyTelegram(receiptCheckMessage(result))
  }

  return result
}
