import { GoogleGenAI, Type } from '@google/genai'
import type { QueryClient } from '@/lib/queries'
import { getOpenShoppingItems } from '@/lib/queries'
import { Constants } from '@/types/database'
import type { Database, Json } from '@/types/database'
import { RECEIPTS_BUCKET, buildReceiptPath, isAcceptedReceiptMime } from './receipts'

export type ShoppingCategory = Database['public']['Enums']['shopping_category']
export type ShoppingUrgency = Database['public']['Enums']['shopping_urgency']
export type BoughtVia = 'app' | 'assistente' | 'scontrino'
export type ReceiptSource = 'app' | 'telegram' | 'spesa'

export const SHOPPING_CATEGORIES = Constants.public.Enums.shopping_category
export const SHOPPING_URGENCIES = Constants.public.Enums.shopping_urgency

/** Violazione dell'indice unico sugli articoli aperti (stesso nome due volte). */
const UNIQUE_VIOLATION = '23505'

export interface ShoppingItemInput {
  name: string
  category?: string | null
  quantity?: string | null
  urgency?: string | null
  note?: string | null
}

export type AddItemResult =
  | { ok: true; id: string; name: string; urgency: ShoppingUrgency }
  | { ok: false; error: string; duplicate?: boolean }

function normalizeCategory(value: unknown): ShoppingCategory {
  const v = String(value ?? '').trim()
  return (SHOPPING_CATEGORIES as readonly string[]).includes(v)
    ? (v as ShoppingCategory)
    : 'altro'
}

function normalizeUrgency(value: unknown): ShoppingUrgency {
  const v = String(value ?? '').trim()
  return (SHOPPING_URGENCIES as readonly string[]).includes(v)
    ? (v as ShoppingUrgency)
    : 'media'
}

function cleanOptional(value: unknown): string | null {
  const v = String(value ?? '').trim()
  return v ? v : null
}

/**
 * Aggiunge un articolo alla lista. Il doppione (stesso nome tra gli articoli
 * ancora da comprare) lo blocca l'indice unico sul database: qui si traduce
 * l'errore di Postgres in una frase leggibile invece di duplicare il
 * controllo con una SELECT che sarebbe comunque in corsa con l'altro utente.
 */
export async function addShoppingItem(
  db: QueryClient,
  userId: string,
  input: ShoppingItemInput,
): Promise<AddItemResult> {
  const name = String(input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Il nome del prodotto è obbligatorio.' }
  if (name.length > 120) return { ok: false, error: 'Il nome del prodotto è troppo lungo.' }

  const urgency = normalizeUrgency(input.urgency)

  const { data, error } = await db
    .from('shopping_items')
    .insert({
      name,
      category: normalizeCategory(input.category),
      quantity: cleanOptional(input.quantity),
      urgency,
      note: cleanOptional(input.note),
      added_by: userId,
    })
    .select('id, name, urgency')
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: `"${name}" è già in lista.`, duplicate: true }
    }
    return { ok: false, error: 'Errore durante il salvataggio. Riprova.' }
  }

  return { ok: true, id: data.id, name: data.name, urgency: data.urgency }
}

export interface AddItemsResult {
  added: { id: string; name: string; urgency: ShoppingUrgency }[]
  duplicates: string[]
  failed: string[]
}

/**
 * Aggiunge più articoli in un colpo solo ("aggiungi latte, pane e uova").
 * Un doppione non fa fallire gli altri: si registra e si tira avanti.
 */
export async function addShoppingItems(
  db: QueryClient,
  userId: string,
  items: ShoppingItemInput[],
): Promise<AddItemsResult> {
  const result: AddItemsResult = { added: [], duplicates: [], failed: [] }

  for (const item of items) {
    const outcome = await addShoppingItem(db, userId, item)
    if (outcome.ok) {
      result.added.push({ id: outcome.id, name: outcome.name, urgency: outcome.urgency })
    } else if (outcome.duplicate) {
      result.duplicates.push(String(item.name ?? '').trim())
    } else {
      result.failed.push(String(item.name ?? '').trim())
    }
  }

  return result
}

export async function updateShoppingItem(
  db: QueryClient,
  id: string,
  input: ShoppingItemInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = String(input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Il nome del prodotto è obbligatorio.' }

  const { error } = await db
    .from('shopping_items')
    .update({
      name,
      category: normalizeCategory(input.category),
      quantity: cleanOptional(input.quantity),
      urgency: normalizeUrgency(input.urgency),
      note: cleanOptional(input.note),
    })
    .eq('id', id)

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { ok: false, error: `"${name}" è già in lista.` }
    return { ok: false, error: 'Errore durante il salvataggio. Riprova.' }
  }
  return { ok: true }
}

/**
 * Spunta uno o più articoli. Aggiorna solo quelli ancora aperti: se l'altro
 * li ha già spuntati nel frattempo, la sua registrazione resta.
 *
 * @returns i nomi degli articoli effettivamente spuntati.
 */
export async function markShoppingItemsBought(
  db: QueryClient,
  userId: string,
  ids: string[],
  via: BoughtVia,
): Promise<{ ok: true; names: string[] } | { ok: false; error: string }> {
  if (ids.length === 0) return { ok: true, names: [] }

  const { data, error } = await db
    .from('shopping_items')
    .update({
      bought_at: new Date().toISOString(),
      bought_by: userId,
      bought_via: via,
    })
    .in('id', ids)
    .is('bought_at', null)
    .select('name')

  if (error) return { ok: false, error: 'Errore durante il salvataggio. Riprova.' }
  return { ok: true, names: (data ?? []).map((r) => r.name) }
}

/** Rimette in lista un articolo spuntato per sbaglio. */
export async function restoreShoppingItem(
  db: QueryClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db
    .from('shopping_items')
    .update({
      bought_at: null,
      bought_by: null,
      bought_via: null,
      receipt_check_id: null,
      receipt_line: null,
    })
    .eq('id', id)

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: 'Un articolo con lo stesso nome è già in lista.' }
    }
    return { ok: false, error: 'Errore durante il ripristino. Riprova.' }
  }
  return { ok: true }
}

export async function deleteShoppingItem(
  db: QueryClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db.from('shopping_items').delete().eq('id', id)
  if (error) return { ok: false, error: 'Errore durante l\'eliminazione. Riprova.' }
  return { ok: true }
}

/** Svuota lo storico dei comprati; gli articoli ancora da comprare restano. */
export async function clearBoughtShoppingItems(
  db: QueryClient,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { data, error } = await db
    .from('shopping_items')
    .delete()
    .not('bought_at', 'is', null)
    .select('id')

  if (error) return { ok: false, error: 'Errore durante la pulizia. Riprova.' }
  return { ok: true, count: (data ?? []).length }
}

// ------------------------------------------------------------
// Controllo scontrino
// ------------------------------------------------------------

export interface ReceiptLine {
  name: string
  quantity: string | null
  price: number | null
}

export interface ReceiptCheckOk {
  ok: true
  checkId: string
  storeName: string | null
  receiptDate: string | null
  receiptTotal: number | null
  /** Articoli della lista riconosciuti sullo scontrino e appena spuntati. */
  matched: { id: string; name: string; receiptLine: string }[]
  /** Articoli che erano in lista e sullo scontrino non ci sono. */
  missing: { id: string; name: string; quantity: string | null; urgency: ShoppingUrgency }[]
  /** Righe dello scontrino che non corrispondono a nessun articolo in lista. */
  extraLines: string[]
}

export type ReceiptCheckResult = ReceiptCheckOk | { ok: false; error: string }

interface ReceiptCheckParams {
  db: QueryClient
  userId: string
  apiKey: string
  source: ReceiptSource
  fileName: string
  mimeType: string
  /** Byte dello scontrino: già in memoria (Telegram, allegato di una spesa). */
  bytes: Uint8Array
  /** Modello Gemini da usare per la lettura. */
  model: string
}

/**
 * Confronta uno scontrino con la lista della spesa: legge le righe con
 * Gemini, spunta gli articoli riconosciuti ed evidenzia quelli che restano.
 *
 * Il riconoscimento lo fa il modello, non un confronto di stringhe: sugli
 * scontrini i prodotti sono abbreviati e storpiati ("LT PS PARM 1L" = latte
 * parzialmente scremato), e nessuna normalizzazione testuale regge il colpo.
 * Gli id che il modello restituisce vengono però sempre riverificati contro
 * la lista reale prima di scrivere: il modello propone, il server dispone.
 */
export async function runReceiptCheck(params: ReceiptCheckParams): Promise<ReceiptCheckResult> {
  const { db, userId, apiKey, source, fileName, mimeType, bytes, model } = params

  if (!isAcceptedReceiptMime(mimeType)) {
    return { ok: false, error: 'Formato non supportato: serve una foto JPG, PNG, WEBP o un PDF.' }
  }
  if (bytes.byteLength === 0) {
    return { ok: false, error: 'Il file dello scontrino è vuoto.' }
  }

  const openItems = await getOpenShoppingItems(db)

  // Lo scontrino si conserva anche quando la lista è vuota: serve comunque da
  // riferimento temporale per il prossimo "cosa manca dall'ultimo scontrino".
  const reading = await readReceipt({ apiKey, model, mimeType, bytes, openItems })
  if (!reading.ok) return reading

  const byId = new Map(openItems.map((i) => [i.id, i]))
  const matched: ReceiptCheckOk['matched'] = []
  const seen = new Set<string>()
  for (const m of reading.matches) {
    const item = byId.get(m.itemId)
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    matched.push({ id: item.id, name: item.name, receiptLine: m.receiptLine })
  }

  const storagePath = buildReceiptPath(mimeType)
  const { error: uploadError } = await db.storage
    .from(RECEIPTS_BUCKET)
    .upload(storagePath, bytes, { contentType: mimeType, upsert: false })

  if (uploadError) {
    return { ok: false, error: 'Non sono riuscito a salvare la foto dello scontrino.' }
  }

  const { data: checkId, error: rpcError } = await db.rpc('register_receipt_check', {
    p_storage_path: storagePath,
    p_file_name: fileName,
    p_mime_type: mimeType,
    p_size_bytes: bytes.byteLength,
    p_source: source,
    p_item_ids: matched.map((m) => m.id),
    p_lines: reading.lines as unknown as Json,
    p_store_name: reading.storeName ?? undefined,
    p_receipt_date: reading.receiptDate ?? undefined,
    p_receipt_total: reading.receiptTotal ?? undefined,
    p_checked_by: userId,
  })

  if (rpcError || !checkId) {
    // Niente file orfani nel bucket se la transazione non è andata a buon fine.
    await db.storage.from(RECEIPTS_BUCKET).remove([storagePath])
    console.error('[spesa] register_receipt_check fallita:', rpcError)
    return { ok: false, error: 'Errore durante la registrazione del controllo. Riprova.' }
  }

  // Le righe che il modello ha collegato a un articolo non sono "in più".
  const matchedLines = new Set(matched.map((m) => m.receiptLine.toLowerCase()))

  return {
    ok: true,
    checkId,
    storeName: reading.storeName,
    receiptDate: reading.receiptDate,
    receiptTotal: reading.receiptTotal,
    matched,
    missing: openItems
      .filter((i) => !seen.has(i.id))
      .map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, urgency: i.urgency })),
    extraLines: reading.lines
      .map((l) => l.name)
      .filter((name) => name && !matchedLines.has(name.toLowerCase())),
  }
}

interface ReceiptReading {
  ok: true
  storeName: string | null
  receiptDate: string | null
  receiptTotal: number | null
  lines: ReceiptLine[]
  matches: { itemId: string; receiptLine: string }[]
}

/** Una sola chiamata a Gemini: legge lo scontrino e lo confronta con la lista. */
async function readReceipt(params: {
  apiKey: string
  model: string
  mimeType: string
  bytes: Uint8Array
  openItems: { id: string; name: string; quantity: string | null }[]
}): Promise<ReceiptReading | { ok: false; error: string }> {
  const { apiKey, model, mimeType, bytes, openItems } = params

  const listBlock = openItems.length
    ? openItems
        .map((i) => `- [${i.id}] ${i.name}${i.quantity ? ` (${i.quantity})` : ''}`)
        .join('\n')
    : '(la lista della spesa è vuota)'

  const ai = new GoogleGenAI({ apiKey })

  try {
    const result = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: Buffer.from(bytes).toString('base64'), mimeType } },
            {
              text: [
                'Questo è lo scontrino della spesa di una coppia che tiene una lista della spesa condivisa.',
                '',
                'Fai due cose:',
                '1. Trascrivi le righe dei PRODOTTI acquistati (salta totali, sconti, resto, punti fedeltà, IVA e intestazioni). Per ogni riga: il nome come compare sullo scontrino, la quantità se indicata, il prezzo pagato.',
                '2. Collega ogni riga, quando possibile, a un articolo della lista qui sotto. I nomi sugli scontrini sono abbreviati e maiuscoli ("LT PS 1L" = latte parzialmente scremato, "POM PELATI" = pomodori pelati): usa il buonsenso della spesa italiana. Collega solo quando sei ragionevolmente sicuro; se un articolo della lista non c\'è sullo scontrino, semplicemente non collegarlo. Non inventare id.',
                '',
                'LISTA DELLA SPESA (formato: [id] nome (quantità)):',
                listBlock,
                '',
                'Restituisci anche negozio, data (YYYY-MM-DD) e totale dello scontrino se sono leggibili, altrimenti lasciali vuoti.',
              ].join('\n'),
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            store_name: { type: Type.STRING },
            receipt_date: { type: Type.STRING },
            total: { type: Type.NUMBER },
            lines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                },
                required: ['name'],
              },
            },
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  item_id: { type: Type.STRING },
                  receipt_line: { type: Type.STRING },
                },
                required: ['item_id', 'receipt_line'],
              },
            },
          },
          required: ['lines', 'matches'],
        },
      },
    })

    const text = result.text
    if (!text) {
      return { ok: false, error: 'Non sono riuscito a leggere lo scontrino. Riprova con una foto più nitida.' }
    }

    const parsed = JSON.parse(text) as {
      store_name?: string
      receipt_date?: string
      total?: number
      lines?: { name?: string; quantity?: string; price?: number }[]
      matches?: { item_id?: string; receipt_line?: string }[]
    }

    const lines: ReceiptLine[] = (parsed.lines ?? [])
      .map((l) => ({
        name: String(l.name ?? '').trim(),
        quantity: cleanOptional(l.quantity),
        price: Number.isFinite(l.price) ? Math.round((l.price as number) * 100) / 100 : null,
      }))
      .filter((l) => l.name)

    const rawDate = String(parsed.receipt_date ?? '').trim()

    return {
      ok: true,
      storeName: cleanOptional(parsed.store_name),
      receiptDate: /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null,
      receiptTotal:
        Number.isFinite(parsed.total) && (parsed.total as number) > 0
          ? Math.round((parsed.total as number) * 100) / 100
          : null,
      lines,
      matches: (parsed.matches ?? [])
        .map((m) => ({
          itemId: String(m.item_id ?? '').trim(),
          receiptLine: String(m.receipt_line ?? '').trim(),
        }))
        .filter((m) => m.itemId),
    }
  } catch (e) {
    console.error('[spesa] lettura scontrino fallita:', e)
    return { ok: false, error: 'Errore durante la lettura dello scontrino. Riprova tra poco.' }
  }
}
