import { getTelegramConfig, type TelegramConfig } from './config'
import { htmlToPlain, splitMessage } from './format'

const API_BASE = 'https://api.telegram.org'
// Le notifiche non devono mai far attendere l'utente dell'app: se Telegram non
// risponde entro questo tempo si rinuncia e si registra l'errore nei log.
const TIMEOUT_MS = 8000

async function callApi(
  config: TelegramConfig,
  method: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; description?: string }> {
  try {
    const res = await fetch(`${API_BASE}/bot${config.botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    const body = (await res.json()) as { ok?: boolean; description?: string }
    if (!res.ok || !body.ok) {
      return { ok: false, description: body.description ?? `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : 'errore di rete' }
  }
}

export interface SendMessageOptions {
  /** Chat di destinazione. Default: il gruppo configurato in TELEGRAM_CHAT_ID. */
  chatId?: string | number
  /** Id del messaggio a cui rispondere (thread di gruppo). */
  replyTo?: number
  /**
   * Testo alternativo senza formattazione, usato se Telegram rifiuta l'HTML.
   * Default: lo stesso testo, che in quel caso viene inviato così com'è.
   */
  plainFallback?: string
  /** Disattiva l'anteprima dei link (default: disattivata). */
  linkPreview?: boolean
}

/**
 * Invia un messaggio HTML nella chat, spezzandolo se supera il limite di
 * Telegram. Non solleva mai: un'integrazione non configurata o un errore di
 * rete non devono far fallire la spesa che l'utente sta salvando.
 *
 * @returns true se almeno un pezzo è stato consegnato.
 */
export async function sendTelegramMessage(
  html: string,
  options: SendMessageOptions = {},
): Promise<boolean> {
  const config = getTelegramConfig()
  if (!config) return false

  // Senza destinatario non c'è niente da fare: succede quando il bot ha il token
  // ma il gruppo non è ancora configurato.
  const chatId = options.chatId ?? config.chatId
  if (!chatId) return false

  const chunks = splitMessage(html)
  let delivered = false

  for (const [index, chunk] of chunks.entries()) {
    const base = {
      chat_id: chatId,
      link_preview_options: { is_disabled: options.linkPreview !== true },
      // Si risponde in-thread solo al primo pezzo, altrimenti la chat si riempie
      // di frecce di citazione.
      ...(options.replyTo && index === 0 ? { reply_to_message_id: options.replyTo } : {}),
    }

    let result = await callApi(config, 'sendMessage', {
      ...base,
      text: chunk,
      parse_mode: 'HTML',
    })

    // Se la conversione ha prodotto HTML che Telegram non digerisce, meglio un
    // messaggio senza formattazione che nessun messaggio.
    if (!result.ok) {
      console.error('[telegram] sendMessage HTML fallito:', result.description)
      const plain = options.plainFallback ?? htmlToPlain(chunk)
      result = await callApi(config, 'sendMessage', { ...base, text: plain })
      if (!result.ok) {
        console.error('[telegram] sendMessage in chiaro fallito:', result.description)
      }
    }

    delivered = delivered || result.ok
  }

  return delivered
}

/** Mostra "sta scrivendo…" nella chat mentre l'assistente elabora la risposta. */
export async function sendTypingAction(chatId: string | number): Promise<void> {
  const config = getTelegramConfig()
  if (!config) return
  await callApi(config, 'sendChatAction', { chat_id: chatId, action: 'typing' })
}

export interface TelegramDownloadedFile {
  bytes: Uint8Array
  mimeType: string
  fileName: string
}

// Le foto compresse di Telegram sono sempre JPEG, ma il getFile non lo dice:
// il tipo si deduce dall'estensione del file_path, con JPEG come fallback.
const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

/**
 * Scarica un file inviato al bot (la foto di uno scontrino, tipicamente).
 * Sono due chiamate: `getFile` restituisce un `file_path` temporaneo, poi il
 * file si preleva dall'endpoint dei file. Non solleva: come per l'invio, un
 * problema di rete verso Telegram non deve propagarsi nell'app.
 *
 * @returns i byte del file, o `null` se non è stato possibile scaricarlo.
 */
export async function downloadTelegramFile(
  fileId: string,
  fallbackName = 'scontrino.jpg',
): Promise<TelegramDownloadedFile | null> {
  const config = getTelegramConfig()
  if (!config) return null

  try {
    const infoRes = await fetch(`${API_BASE}/bot${config.botToken}/getFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    const info = (await infoRes.json()) as {
      ok?: boolean
      result?: { file_path?: string }
      description?: string
    }
    const filePath = info.result?.file_path
    if (!infoRes.ok || !info.ok || !filePath) {
      console.error('[telegram] getFile fallito:', info.description ?? `HTTP ${infoRes.status}`)
      return null
    }

    // Il download può essere di qualche MB: timeout più largo dell'invio.
    const fileRes = await fetch(`${API_BASE}/file/bot${config.botToken}/${filePath}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS * 4),
      cache: 'no-store',
    })
    if (!fileRes.ok) {
      console.error('[telegram] download del file fallito:', `HTTP ${fileRes.status}`)
      return null
    }

    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    return {
      bytes: new Uint8Array(await fileRes.arrayBuffer()),
      mimeType: MIME_BY_EXT[ext] ?? 'image/jpeg',
      fileName: filePath.split('/').pop() || fallbackName,
    }
  } catch (e) {
    console.error('[telegram] download del file non riuscito:', e)
    return null
  }
}
