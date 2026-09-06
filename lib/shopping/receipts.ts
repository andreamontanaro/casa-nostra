/**
 * Costanti e helper puri del controllo scontrino. Niente client Supabase qui
 * dentro: il file è importato sia dal browser (la sheet che carica la foto)
 * sia dal server (l'assistente e il webhook Telegram).
 */

export const RECEIPTS_BUCKET = 'shopping-receipts'

export const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

// Gli stessi formati che Gemini sa leggere come allegato di una spesa.
export const ACCEPTED_RECEIPT_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

export type AcceptedReceiptMime = (typeof ACCEPTED_RECEIPT_MIME)[number]

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export function isAcceptedReceiptMime(mime: string): boolean {
  return (ACCEPTED_RECEIPT_MIME as readonly string[]).includes(mime)
}

/**
 * Percorso nel bucket: `YYYY/MM/uuid.ext`. Raggruppare per mese tiene
 * navigabile il bucket dal pannello Supabase senza dover interrogare il DB.
 */
export function buildReceiptPath(mime: string, now = new Date()): string {
  const ext = EXT_BY_MIME[mime] ?? 'bin'
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}/${month}/${crypto.randomUUID()}.${ext}`
}

/** Messaggio d'errore in italiano, o `null` se il file va bene. */
export function validateReceiptFile(file: { type: string; size: number }): string | null {
  if (!isAcceptedReceiptMime(file.type)) {
    return 'Formato non supportato: serve una foto JPG, PNG, WEBP o un PDF.'
  }
  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    return 'Lo scontrino supera i 10 MB.'
  }
  if (file.size <= 0) {
    return 'Il file è vuoto.'
  }
  return null
}
