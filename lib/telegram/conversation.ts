import type { ServiceClient } from '@/lib/supabase/service'
import type { AssistantMessage } from '@/lib/assistant/run'

// Quanta memoria dare all'assistente: abbastanza per reggere una conferma
// ("aggiungi 12€ di spesa" → "confermi?" → "sì") senza trascinarsi dietro
// conversazioni di giorni prima.
const HISTORY_LIMIT = 20
const HISTORY_WINDOW_MINUTES = 180
const RETENTION_DAYS = 30

/**
 * Registra il messaggio in arrivo e, allo stesso tempo, fa da lucchetto contro i
 * doppioni: `update_id` è UNIQUE, quindi se Telegram riconsegna lo stesso update
 * l'insert fallisce e il messaggio non viene elaborato due volte.
 *
 * @returns true se l'update è nuovo e va elaborato.
 */
export async function claimUpdate(
  db: ServiceClient,
  params: { chatId: number; updateId: number; senderName: string; content: string },
): Promise<boolean> {
  const { error } = await db.from('telegram_messages').insert({
    chat_id: params.chatId,
    update_id: params.updateId,
    role: 'user',
    sender_name: params.senderName,
    content: params.content,
  })

  if (error) {
    // 23505 = unique_violation: update già elaborato, non è un errore.
    if (error.code !== '23505') {
      console.error('[telegram] salvataggio messaggio fallito:', error.message)
    }
    return false
  }

  return true
}

/** Salva la risposta dell'assistente, così resta nella memoria della chat. */
export async function saveAssistantReply(
  db: ServiceClient,
  chatId: number,
  content: string,
): Promise<void> {
  const { error } = await db.from('telegram_messages').insert({
    chat_id: chatId,
    role: 'model',
    content,
  })
  if (error) console.error('[telegram] salvataggio risposta fallito:', error.message)
}

/**
 * Cronologia recente della chat, pronta per l'assistente. I messaggi degli utenti
 * vengono prefissati col nome di chi ha scritto: nel gruppo è l'unico modo per
 * capire chi sta dicendo "io".
 */
export async function loadHistory(
  db: ServiceClient,
  chatId: number,
): Promise<AssistantMessage[]> {
  const since = new Date(Date.now() - HISTORY_WINDOW_MINUTES * 60_000).toISOString()

  const { data, error } = await db
    .from('telegram_messages')
    .select('role, sender_name, content, created_at')
    .eq('chat_id', chatId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)

  if (error || !data) {
    if (error) console.error('[telegram] lettura cronologia fallita:', error.message)
    return []
  }

  const ordered = [...data].reverse()
  const messages: AssistantMessage[] = []

  for (const row of ordered) {
    const role = row.role === 'model' ? 'model' : 'user'
    const text =
      role === 'user' && row.sender_name
        ? `[${row.sender_name}] ${row.content}`
        : row.content

    // Gemini gradisce turni alternati: due messaggi di fila dello stesso ruolo
    // (tipico in un gruppo, dove i due utenti scrivono in sequenza) vengono uniti.
    const last = messages[messages.length - 1]
    if (last && last.role === role) last.text += `\n${text}`
    else messages.push({ role, text })
  }

  return messages
}

/** Elimina la memoria più vecchia della finestra di ritenzione. */
export async function pruneHistory(db: ServiceClient): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60_000).toISOString()
  const { error } = await db.from('telegram_messages').delete().lt('created_at', cutoff)
  if (error) console.error('[telegram] pulizia cronologia fallita:', error.message)
}
