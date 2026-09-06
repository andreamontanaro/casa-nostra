import { ATTACHMENTS_BUCKET, ACCEPTED_MIME, buildStoragePath } from '@/lib/attachments'
import { DEFAULT_SPLIT, todayISO } from '@/lib/fmt'
import type { QueryClient } from '@/lib/queries'
import { Constants } from '@/types/database'
import type { Database } from '@/types/database'

type ExpenseCategory = Database['public']['Enums']['expense_category']
type SplitRule = Database['public']['Enums']['split_rule']

const EXPENSE_CATEGORIES = Constants.public.Enums.expense_category

/** Categoria di ripiego: uno scontrino, salvo indizi contrari, è la spesa. */
const FALLBACK_CATEGORY: ExpenseCategory = 'spesa_alimentare'

export interface ReceiptExpense {
  id: string
  amount: number
  description: string
  category: ExpenseCategory
  splitRule: SplitRule
  payerName: string
  expenseDate: string
  /** L'immagine è stata allegata alla spesa come scontrino. */
  attached: boolean
}

export type ReceiptExpenseOutcome =
  | { created: true; expense: ReceiptExpense }
  /** Totale illeggibile: senza importo non c'è nessuna spesa da registrare. */
  | { created: false; reason: 'no-total' }
  /** Esisteva già una spesa identica per importo e data: non se ne crea una seconda. */
  | { created: false; reason: 'duplicate'; existingId: string; description: string }
  | { created: false; reason: 'error' }

export interface CreateExpenseFromReceiptParams {
  /** Totale letto sullo scontrino. */
  amount: number | null
  storeName: string | null
  /** Data letta sullo scontrino, formato YYYY-MM-DD. */
  receiptDate: string | null
  /** Categoria proposta dal modello, riverificata qui. */
  category: string | null
  /** Byte dello scontrino, da allegare alla spesa. */
  bytes: Uint8Array
  mimeType: string
}

/**
 * Registra la spesa corrispondente a uno scontrino, con le opzioni di
 * default dell'app: importo e data letti dallo scontrino, pagante chi lo ha
 * inviato, divisione quella predefinita per la categoria (`DEFAULT_SPLIT`,
 * la stessa che il form propone). Non è una scorciatoia con regole sue: è il
 * form compilato in automatico, e resta tutto modificabile dalla spesa.
 *
 * Non solleva mai: uno scontrino confrontato con la lista resta utile anche
 * se la spesa non si è potuta registrare.
 */
export async function createExpenseFromReceipt(
  db: QueryClient,
  userId: string,
  params: CreateExpenseFromReceiptParams,
): Promise<ReceiptExpenseOutcome> {
  const { amount, storeName, receiptDate, bytes, mimeType } = params

  if (!Number.isFinite(amount) || (amount ?? 0) <= 0) return { created: false, reason: 'no-total' }
  const roundedAmount = Math.round((amount as number) * 100) / 100

  const rawCategory = String(params.category ?? '').trim()
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as ExpenseCategory)
    : FALLBACK_CATEGORY
  const splitRule = DEFAULT_SPLIT[category]

  const expenseDate = /^\d{4}-\d{2}-\d{2}$/.test(String(receiptDate ?? ''))
    ? (receiptDate as string)
    : todayISO()

  const description = storeName ? `Spesa da ${storeName}` : 'Spesa da scontrino'

  try {
    // Stesso importo e stessa data = quasi certamente lo stesso scontrino,
    // mandato due volte o già registrato a mano. Una spesa doppia falsa il
    // saldo, che è l'invariante centrale dell'app: meglio non crearla e
    // dirlo, così se davvero erano due spese la si aggiunge dall'app.
    const { data: existing } = await db
      .from('expenses')
      .select('id, description')
      .eq('expense_date', expenseDate)
      .eq('amount', roundedAmount)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return {
        created: false,
        reason: 'duplicate',
        existingId: existing.id,
        description: existing.description,
      }
    }

    const { data: inserted, error } = await db
      .from('expenses')
      .insert({
        amount: roundedAmount,
        description,
        category,
        split_rule: splitRule,
        paid_by: userId,
        expense_date: expenseDate,
        created_by: userId,
        custom_other_share: null,
      })
      .select('id')
      .single()

    if (error || !inserted) {
      console.error('[scontrino] spesa non registrata:', error)
      return { created: false, reason: 'error' }
    }

    const { data: profile } = await db
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()

    return {
      created: true,
      expense: {
        id: inserted.id,
        amount: roundedAmount,
        description,
        category,
        splitRule,
        payerName: profile?.display_name ?? 'Qualcuno',
        expenseDate,
        attached: await attachReceipt(db, inserted.id, userId, bytes, mimeType),
      },
    }
  } catch (e) {
    console.error('[scontrino] spesa non registrata:', e)
    return { created: false, reason: 'error' }
  }
}

/**
 * Allega alla spesa la stessa foto usata per il controllo, così lo scontrino
 * si rivede dal dettaglio della spesa e l'assistente può leggerlo con
 * `get_attachments`. Un allegato mancato non annulla la spesa: è un extra.
 *
 * @returns true se l'allegato è stato registrato.
 */
async function attachReceipt(
  db: QueryClient,
  expenseId: string,
  userId: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<boolean> {
  // Gli allegati delle spese accettano meno formati del controllo scontrino
  // (niente WEBP): un formato non previsto resta solo nel bucket dei
  // controlli invece di finire come file illeggibile su una spesa.
  if (!(ACCEPTED_MIME as readonly string[]).includes(mimeType)) return false

  const path = buildStoragePath(expenseId, mimeType)

  const { error: uploadError } = await db.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: false })
  if (uploadError) {
    console.error('[scontrino] allegato non caricato:', uploadError)
    return false
  }

  const { error: insertError } = await db.from('expense_attachments').insert({
    expense_id: expenseId,
    storage_path: path,
    file_name: `scontrino.${path.split('.').pop() ?? 'jpg'}`,
    mime_type: mimeType,
    size_bytes: bytes.byteLength,
    uploaded_by: userId,
  })

  if (insertError) {
    await db.storage.from(ATTACHMENTS_BUCKET).remove([path])
    console.error('[scontrino] allegato non registrato:', insertError)
    return false
  }

  return true
}
