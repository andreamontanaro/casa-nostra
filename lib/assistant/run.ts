import { GoogleGenAI, type Content, type Part, type FunctionCall } from '@google/genai'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ACCEPTED_MIME, ATTACHMENTS_BUCKET } from '@/lib/attachments'
import { CATEGORY_LABELS, SPLIT_LABELS, formatEur, todayISO } from '@/lib/fmt'
import {
  getExpenseAttachments,
  getOpenBalance,
  getProfiles,
  type QueryClient,
} from '@/lib/queries'
import { sendTelegramMessage } from '@/lib/telegram/api'
import {
  expenseCreatedMessage,
  expenseDeletedMessage,
  notifyTelegram,
  receiptCheckMessage,
  urgentItemAddedMessage,
} from '@/lib/telegram/notify'
import {
  addShoppingItems,
  deleteShoppingItem,
  markShoppingItemsBought,
  runReceiptCheck,
  type ShoppingItemInput,
} from '@/lib/shopping/service'
import { Constants } from '@/types/database'
import type { Database } from '@/types/database'
import { buildSystemInstruction, type AssistantChannel } from './instructions'
import {
  addShoppingItemsTool,
  checkExpenseReceiptTool,
  createExpenseTool,
  deleteExpenseTool,
  getAttachmentsTool,
  markShoppingBoughtTool,
  removeShoppingItemsTool,
} from './tools'

export const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest'
export const MAX_TURNS = 5

type ExpenseCategory = Database['public']['Enums']['expense_category']
type SplitRule = Database['public']['Enums']['split_rule']

const VALID_CATEGORIES = Constants.public.Enums.expense_category
const VALID_SPLITS = Constants.public.Enums.split_rule

export interface AssistantMessage {
  role: 'user' | 'model'
  text: string
}

export interface RunAssistantOptions {
  /** Cronologia della conversazione, dal più vecchio al più recente. */
  messages: AssistantMessage[]
  /** Profilo per conto del quale l'assistente agisce (crea le spese, dice "io"). */
  userId: string
  /** Client Supabase: omesso usa la sessione dell'utente, con RLS attiva. */
  db?: QueryClient
  /** Canale della conversazione: cambia le istruzioni di formato. */
  channel?: AssistantChannel
  /** Chiave API Gemini (default: GEMINI_API_KEY). */
  apiKey: string
  /** Testo prodotto dal modello, man mano che arriva. */
  onText?: (chunk: string) => void
  /** Frase di stato dichiarata dal modello prima di eseguire uno strumento. */
  onAction?: (action: string) => void
  /** Invocata quando l'assistente ha davvero creato una spesa. */
  onExpenseCreated?: (expenseId: string) => void
  /** Invocata quando l'assistente ha davvero eliminato una spesa. */
  onExpenseDeleted?: (expenseId: string) => void
  /** Invocata quando l'assistente ha modificato la lista della spesa. */
  onShoppingChanged?: () => void
}

/**
 * Esegue un giro completo di conversazione con Gemini, risolvendo le chiamate a
 * strumento fino alla risposta finale. È il cuore condiviso fra la chat dentro
 * l'app (che fa streaming verso il browser) e il bot Telegram (che raccoglie il
 * testo e lo pubblica nel gruppo).
 *
 * @returns il testo finale destinato all'utente.
 */
export async function runAssistant(options: RunAssistantOptions): Promise<string> {
  const { messages, userId, db, channel = 'app', apiKey, onText, onAction } = options

  const systemInstruction = await buildSystemInstruction(userId, { db, channel })
  const ai = new GoogleGenAI({ apiKey })

  const contents: Content[] = messages
    .filter((m) => m.text?.trim())
    .map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }))

  const config = {
    systemInstruction,
    tools: [
      {
        functionDeclarations: [
          getAttachmentsTool,
          createExpenseTool,
          deleteExpenseTool,
          addShoppingItemsTool,
          markShoppingBoughtTool,
          removeShoppingItemsTool,
          checkExpenseReceiptTool,
        ],
      },
    ],
    temperature: 0.4,
  }

  let finalText = ''
  let turn = 0

  while (turn++ < MAX_TURNS) {
    const result = await ai.models.generateContentStream({ model: MODEL, contents, config })

    // Accumuliamo le part così come arrivano dal modello: le function call
    // di Gemini 3.x portano un `thoughtSignature` che DEVE essere rimandato
    // indietro intatto, quindi non ricostruiamo il turno da zero.
    // Bufferizziamo il testo del turno: lo consegniamo SOLO se questo turno non
    // contiene function call. Nei turni in cui il modello chiama un tool capita
    // che emetta testo di servizio (es. il nome del file) che non deve uscire.
    const modelParts: Part[] = []
    const turnCalls: FunctionCall[] = []
    let turnText = ''

    for await (const chunk of result) {
      const parts = chunk.candidates?.[0]?.content?.parts
      if (!parts) continue
      for (const part of parts) {
        modelParts.push(part)
        if (part.functionCall) {
          turnCalls.push(part.functionCall)
        } else if (part.text && !part.thought) {
          turnText += part.text
        }
      }
    }

    // Nessuna chiamata a funzione: è la risposta finale.
    if (turnCalls.length === 0) {
      if (turnText) {
        finalText = turnText
        onText?.(turnText)
      }
      break
    }

    // Registra il turno del modello (part originali, firma inclusa) e risolvi i tool.
    contents.push({ role: 'model', parts: modelParts })

    const responseParts: Part[] = []
    for (const call of turnCalls) {
      // Comunica cosa sta facendo l'assistente PRIMA di eseguire il tool, così
      // la frase compare mentre lo strumento lavora.
      const action = String(
        (call.args as Record<string, unknown> | undefined)?.action ?? '',
      ).trim()
      if (action) onAction?.(action)

      if (call.name === 'get_attachments') {
        const expenseId = String(
          (call.args as Record<string, unknown> | undefined)?.expense_id ?? '',
        )
        const { summary, media } = await loadAttachmentParts(expenseId, db)
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: 'get_attachments',
            response: { result: summary },
          },
        })
        responseParts.push(...media)
      } else if (call.name === 'create_expense') {
        const result = await createExpenseFromTool(
          call.args as Record<string, unknown> | undefined,
          userId,
          { db, channel },
        )
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: 'create_expense',
            response: result.ok
              ? { result: result.summary, expense_id: result.expenseId }
              : { error: result.error },
          },
        })
        if (result.ok) options.onExpenseCreated?.(result.expenseId)
      } else if (call.name === 'delete_expense') {
        const result = await deleteExpenseFromTool(
          call.args as Record<string, unknown> | undefined,
          userId,
          { db, channel },
        )
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: 'delete_expense',
            response: result.ok ? { result: result.summary } : { error: result.error },
          },
        })
        if (result.ok) options.onExpenseDeleted?.(result.expenseId)
      } else if (call.name === 'add_shopping_items') {
        const result = await addShoppingItemsFromTool(
          call.args as Record<string, unknown> | undefined,
          userId,
          { db, channel },
        )
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: 'add_shopping_items',
            response: result.ok ? { result: result.summary } : { error: result.error },
          },
        })
        if (result.ok) options.onShoppingChanged?.()
      } else if (call.name === 'mark_shopping_bought') {
        const result = await markShoppingBoughtFromTool(
          call.args as Record<string, unknown> | undefined,
          userId,
          { db },
        )
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: 'mark_shopping_bought',
            response: result.ok ? { result: result.summary } : { error: result.error },
          },
        })
        if (result.ok) options.onShoppingChanged?.()
      } else if (call.name === 'remove_shopping_items') {
        const result = await removeShoppingItemsFromTool(
          call.args as Record<string, unknown> | undefined,
          { db },
        )
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: 'remove_shopping_items',
            response: result.ok ? { result: result.summary } : { error: result.error },
          },
        })
        if (result.ok) options.onShoppingChanged?.()
      } else if (call.name === 'check_expense_receipt') {
        const result = await checkExpenseReceiptFromTool(
          call.args as Record<string, unknown> | undefined,
          userId,
          { db, channel, apiKey },
        )
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: 'check_expense_receipt',
            response: result.ok ? { result: result.summary } : { error: result.error },
          },
        })
        if (result.ok) options.onShoppingChanged?.()
      } else {
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: call.name ?? 'unknown',
            response: { error: 'Funzione non riconosciuta.' },
          },
        })
      }
    }

    contents.push({ role: 'user', parts: responseParts })
  }

  return finalText
}

/**
 * Carica gli allegati di una spesa e li trasforma in part multimodali (inlineData)
 * per Gemini, più un riassunto testuale da restituire come functionResponse.
 */
async function loadAttachmentParts(
  expenseId: string,
  db?: QueryClient,
): Promise<{ summary: string; media: Part[] }> {
  if (!expenseId) {
    return { summary: 'Id spesa mancante: impossibile recuperare gli allegati.', media: [] }
  }

  let attachments
  try {
    attachments = await getExpenseAttachments(expenseId, db)
  } catch {
    return { summary: 'Errore nel recupero degli allegati.', media: [] }
  }

  if (attachments.length === 0) {
    return { summary: 'Questa spesa non ha allegati.', media: [] }
  }

  const media: Part[] = []
  const loaded: string[] = []

  for (const att of attachments) {
    if (!att.signed_url || !ACCEPTED_MIME.includes(att.mime_type as never)) continue
    try {
      const res = await fetch(att.signed_url)
      if (!res.ok) continue
      const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
      media.push({ inlineData: { data: base64, mimeType: att.mime_type } })
      loaded.push(att.file_name)
    } catch {
      // salta l'allegato non scaricabile
    }
  }

  if (media.length === 0) {
    return {
      summary: 'Allegati presenti ma non è stato possibile caricarli per la visione.',
      media: [],
    }
  }

  return {
    summary: `Allegati caricati e visibili nel messaggio (${loaded.length}): ${loaded.join(', ')}.`,
    media,
  }
}

type CreateExpenseResult =
  | { ok: true; expenseId: string; summary: string }
  | { ok: false; error: string }

/**
 * Valida gli argomenti del tool create_expense e inserisce la spesa su Supabase.
 * Replica la logica di app/actions/expenses.ts (non riusabile qui perché legata a
 * FormData/redirect) e rispetta i check constraint dello schema.
 */
async function createExpenseFromTool(
  args: Record<string, unknown> | undefined,
  currentUserId: string,
  options: { db?: QueryClient; channel: AssistantChannel },
): Promise<CreateExpenseResult> {
  const a = args ?? {}
  const { db, channel } = options

  // Importo: numero (o stringa con virgola) maggiore di zero.
  const amount =
    typeof a.amount === 'number'
      ? a.amount
      : parseFloat(String(a.amount ?? '').replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Importo non valido: deve essere un numero maggiore di zero.' }
  }

  const description = String(a.description ?? '').trim()
  if (!description) return { ok: false, error: 'La descrizione è obbligatoria.' }

  const category = String(a.category ?? '') as ExpenseCategory
  if (!VALID_CATEGORIES.includes(category as never)) {
    return { ok: false, error: `Categoria non valida: "${category}".` }
  }

  // paid_by deve corrispondere all'id di uno dei due profili reali.
  const profiles = await getProfiles(db)
  const payer = profiles.find((p) => p.id === String(a.paid_by ?? ''))
  if (!payer) {
    return { ok: false, error: 'Non riconosco chi ha pagato (paid_by non valido).' }
  }

  // Regola di divisione: usa quella passata se valida, altrimenti il default per categoria.
  let splitRule = String(a.split_rule ?? '') as SplitRule
  if (!VALID_SPLITS.includes(splitRule as never)) {
    splitRule = category === 'affitto' ? 'fifty_fifty' : 'sixty_forty'
  }

  // custom_other_share: coerente col check expenses_custom_share_consistency.
  let customOtherShare: number | null = null
  if (splitRule === 'custom') {
    const cv =
      typeof a.custom_other_share === 'number'
        ? a.custom_other_share
        : parseFloat(String(a.custom_other_share ?? '').replace(',', '.'))
    if (!Number.isFinite(cv) || cv <= 0 || cv >= amount) {
      return {
        ok: false,
        error:
          "Per la divisione personalizzata serve la quota dell'altra persona, positiva e inferiore al totale.",
      }
    }
    customOtherShare = Math.round(cv * 100) / 100
  }

  // Data: accetta solo YYYY-MM-DD, altrimenti oggi.
  const rawDate = String(a.expense_date ?? '').trim()
  const expenseDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayISO()

  const supabase = db ?? (await createClient())
  const roundedAmount = Math.round(amount * 100) / 100
  const { data: inserted, error } = await supabase
    .from('expenses')
    .insert({
      amount: roundedAmount,
      description,
      category,
      split_rule: splitRule,
      paid_by: payer.id,
      expense_date: expenseDate,
      created_by: currentUserId,
      custom_other_share: customOtherShare,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return { ok: false, error: 'Errore durante il salvataggio della spesa nel database.' }
  }

  // Invalida la cache delle pagine che mostrano le spese (il refresh visivo lo guida il client).
  // A questo punto la spesa è già scritta: un problema di cache non deve far
  // sembrare fallita un'operazione riuscita, quindi non propaga.
  try {
    revalidatePath('/')
    revalidatePath('/spese')
  } catch (e) {
    console.error('[assistant] revalidate fallita dopo la creazione della spesa:', e)
  }

  // Notifica nel gruppo: la spesa creata via assistente è un movimento come gli altri.
  const author = profiles.find((p) => p.id === currentUserId)
  const message = expenseCreatedMessage({
    actorName: author?.display_name ?? 'Assistente',
    expenseId: inserted.id,
    amount: roundedAmount,
    description,
    category,
    splitRule,
    payerName: payer.display_name,
    expenseDate,
    balance: await getOpenBalance(db).catch(() => []),
  })
  if (channel === 'telegram') {
    // Qui siamo già dentro l'elaborazione differita del webhook: inviamo subito.
    await sendTelegramMessage(message)
  } else {
    notifyTelegram(message)
  }

  const catLabel = CATEGORY_LABELS[category] ?? category
  const splitLabel = SPLIT_LABELS[splitRule] ?? splitRule
  const summary =
    `Spesa creata: ${formatEur(amount)} — "${description}" (${catLabel}), ` +
    `divisione ${splitLabel}, pagata da ${payer.display_name}, data ${expenseDate}.`

  return { ok: true, expenseId: inserted.id, summary }
}

type DeleteExpenseResult =
  | { ok: true; expenseId: string; summary: string }
  | { ok: false; error: string }

/**
 * Valida gli argomenti del tool delete_expense ed elimina la spesa da Supabase.
 * Replica la logica di app/actions/expenses.ts::deleteExpense (non riusabile qui
 * perché legata al redirect), incluso il rifiuto delle spese già saldate.
 */
async function deleteExpenseFromTool(
  args: Record<string, unknown> | undefined,
  currentUserId: string,
  options: { db?: QueryClient; channel: AssistantChannel },
): Promise<DeleteExpenseResult> {
  const a = args ?? {}
  const { db, channel } = options

  const expenseId = String(a.expense_id ?? '').trim()
  if (!expenseId) return { ok: false, error: 'Id della spesa mancante.' }

  const supabase = db ?? (await createClient())

  const { data: expense, error: fetchError } = await supabase
    .from('expenses')
    .select('amount, description, category, split_rule, paid_by, expense_date, settlement_id')
    .eq('id', expenseId)
    .single()

  if (fetchError || !expense) {
    return { ok: false, error: 'Spesa non trovata: verifica l\'id.' }
  }
  if (expense.settlement_id) {
    return {
      ok: false,
      error: 'Questa spesa è già stata saldata con un conguaglio e non può più essere eliminata.',
    }
  }

  // La FK ON DELETE CASCADE rimuove le righe expense_attachments, ma non i file
  // su Storage: vanno rimossi a mano prima di eliminare la spesa.
  const { data: attachments } = await supabase
    .from('expense_attachments')
    .select('storage_path')
    .eq('expense_id', expenseId)
  if (attachments && attachments.length > 0) {
    await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .remove(attachments.map((att) => att.storage_path))
  }

  const { error: deleteError } = await supabase.from('expenses').delete().eq('id', expenseId)
  if (deleteError) {
    return { ok: false, error: "Errore durante l'eliminazione della spesa nel database." }
  }

  try {
    revalidatePath('/')
    revalidatePath('/spese')
  } catch (e) {
    console.error('[assistant] revalidate fallita dopo l\'eliminazione della spesa:', e)
  }

  const profiles = await getProfiles(db)
  const author = profiles.find((p) => p.id === currentUserId)
  const payer = profiles.find((p) => p.id === expense.paid_by)
  const message = expenseDeletedMessage({
    actorName: author?.display_name ?? 'Assistente',
    expenseId,
    amount: expense.amount,
    description: expense.description,
    category: expense.category,
    splitRule: expense.split_rule,
    payerName: payer?.display_name ?? 'Qualcuno',
    expenseDate: expense.expense_date,
    balance: await getOpenBalance(db).catch(() => []),
  })
  if (channel === 'telegram') {
    await sendTelegramMessage(message)
  } else {
    notifyTelegram(message)
  }

  const catLabel = CATEGORY_LABELS[expense.category] ?? expense.category
  const summary =
    `Spesa eliminata: ${formatEur(expense.amount)} — "${expense.description}" (${catLabel}), ` +
    `del ${expense.expense_date}.`

  return { ok: true, expenseId, summary }
}

// ------------------------------------------------------------
// Strumenti della lista della spesa
// ------------------------------------------------------------
// A differenza delle spese, qui i tool non riscrivono la logica di dominio:
// chiamano `lib/shopping/service`, lo stesso modulo usato dalle Server Action
// dell'app. Le funzioni qui sotto fanno solo la traduzione argomenti → dominio
// → frase di risposta per il modello.

type ToolResult = { ok: true; summary: string } | { ok: false; error: string }

/** Invalida le pagine della lista dopo una modifica fatta dall'assistente. */
function revalidateShopping() {
  try {
    revalidatePath('/lista')
  } catch (e) {
    console.error('[assistant] revalidate della lista fallita:', e)
  }
}

async function addShoppingItemsFromTool(
  args: Record<string, unknown> | undefined,
  currentUserId: string,
  options: { db?: QueryClient; channel: AssistantChannel },
): Promise<ToolResult> {
  const { db, channel } = options
  const raw = Array.isArray(args?.items) ? (args.items as Record<string, unknown>[]) : []
  const items: ShoppingItemInput[] = raw
    .map((i) => ({
      name: String(i?.name ?? '').trim(),
      category: i?.category as string | undefined,
      quantity: i?.quantity as string | undefined,
      urgency: i?.urgency as string | undefined,
      note: i?.note as string | undefined,
    }))
    .filter((i) => i.name)

  if (items.length === 0) return { ok: false, error: 'Nessun prodotto da aggiungere.' }

  const supabase = db ?? (await createClient())
  const result = await addShoppingItems(supabase, currentUserId, items)

  if (result.added.length === 0 && result.duplicates.length === 0) {
    return { ok: false, error: 'Errore durante il salvataggio degli articoli.' }
  }

  revalidateShopping()

  // Come nell'app, nel gruppo finisce solo l'urgenza vera. Su Telegram non si
  // notifica affatto: la risposta dell'assistente è già nella chat di entrambi.
  if (channel === 'app') {
    const profiles = await getProfiles(db).catch(() => [])
    const actorName =
      profiles.find((p) => p.id === currentUserId)?.display_name ?? 'Assistente'
    for (const item of result.added) {
      if (item.urgency === 'alta') {
        notifyTelegram(urgentItemAddedMessage(actorName, item.name, null))
      }
    }
  }

  const parts: string[] = []
  if (result.added.length > 0) {
    parts.push(`Aggiunti alla lista: ${result.added.map((i) => i.name).join(', ')}.`)
  }
  if (result.duplicates.length > 0) {
    parts.push(`Già in lista (non aggiunti): ${result.duplicates.join(', ')}.`)
  }
  if (result.failed.length > 0) {
    parts.push(`Non salvati per un errore: ${result.failed.join(', ')}.`)
  }

  return { ok: true, summary: parts.join(' ') }
}

async function markShoppingBoughtFromTool(
  args: Record<string, unknown> | undefined,
  currentUserId: string,
  options: { db?: QueryClient },
): Promise<ToolResult> {
  const ids = (Array.isArray(args?.item_ids) ? args.item_ids : [])
    .map((id) => String(id ?? '').trim())
    .filter(Boolean)

  if (ids.length === 0) return { ok: false, error: 'Nessun articolo da spuntare.' }

  const supabase = options.db ?? (await createClient())
  const result = await markShoppingItemsBought(supabase, currentUserId, ids, 'assistente')
  if (!result.ok) return { ok: false, error: result.error }

  if (result.names.length === 0) {
    return {
      ok: false,
      error: 'Nessuno di questi articoli era ancora in lista: forse era già stato spuntato.',
    }
  }

  revalidateShopping()
  return { ok: true, summary: `Segnati come comprati: ${result.names.join(', ')}.` }
}

async function removeShoppingItemsFromTool(
  args: Record<string, unknown> | undefined,
  options: { db?: QueryClient },
): Promise<ToolResult> {
  const ids = (Array.isArray(args?.item_ids) ? args.item_ids : [])
    .map((id) => String(id ?? '').trim())
    .filter(Boolean)

  if (ids.length === 0) return { ok: false, error: 'Nessun articolo da togliere.' }

  const supabase = options.db ?? (await createClient())

  // Si leggono i nomi prima di cancellare: dopo non esistono più e la risposta
  // all'utente resterebbe un elenco di UUID.
  const { data: rows } = await supabase
    .from('shopping_items')
    .select('id, name')
    .in('id', ids)

  const removed: string[] = []
  for (const row of rows ?? []) {
    const result = await deleteShoppingItem(supabase, row.id)
    if (result.ok) removed.push(row.name)
  }

  if (removed.length === 0) return { ok: false, error: 'Non ho trovato quegli articoli in lista.' }

  revalidateShopping()
  return { ok: true, summary: `Tolti dalla lista: ${removed.join(', ')}.` }
}

/**
 * Controllo scontrino su una ricevuta già allegata a una spesa. Stessa logica
 * della Server Action `checkExpenseReceiptAction`, ma con il client esplicito:
 * su Telegram non c'è sessione da cui prendere i permessi.
 */
async function checkExpenseReceiptFromTool(
  args: Record<string, unknown> | undefined,
  currentUserId: string,
  options: { db?: QueryClient; channel: AssistantChannel; apiKey: string },
): Promise<ToolResult> {
  const { db, channel, apiKey } = options
  const expenseId = String(args?.expense_id ?? '').trim()
  if (!expenseId) return { ok: false, error: 'Id della spesa mancante.' }

  const supabase = db ?? (await createClient())

  const attachments = await getExpenseAttachments(expenseId, db).catch(() => [])
  const receipt = attachments[0]
  if (!receipt) return { ok: false, error: 'Questa spesa non ha nessuno scontrino allegato.' }

  const { data: blob, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .download(receipt.storage_path)
  if (error || !blob) return { ok: false, error: 'Non sono riuscito a leggere l\'allegato.' }

  const result = await runReceiptCheck({
    db: supabase,
    userId: currentUserId,
    apiKey,
    model: MODEL,
    source: 'spesa',
    fileName: receipt.file_name,
    mimeType: receipt.mime_type,
    bytes: new Uint8Array(await blob.arrayBuffer()),
  })

  if (!result.ok) return { ok: false, error: result.error }

  revalidateShopping()
  // Sul canale Telegram la risposta dell'assistente è già nel gruppo: una
  // notifica in più direbbe due volte la stessa cosa.
  if (channel === 'app') notifyTelegram(receiptCheckMessage(result))

  return { ok: true, summary: describeReceiptCheck(result) }
}

/** Riassunto testuale di un controllo, da dare in pasto al modello. */
function describeReceiptCheck(check: {
  storeName: string | null
  receiptTotal: number | null
  matched: { name: string }[]
  missing: { name: string; quantity: string | null }[]
}): string {
  const parts = [
    check.storeName ? `Scontrino di ${check.storeName}.` : 'Scontrino controllato.',
    check.receiptTotal !== null ? `Totale letto: ${formatEur(check.receiptTotal)}.` : '',
    check.matched.length > 0
      ? `Spuntati dalla lista (${check.matched.length}): ${check.matched
          .map((m) => m.name)
          .join(', ')}.`
      : 'Nessun articolo della lista riconosciuto sullo scontrino.',
    check.missing.length > 0
      ? `Restano da comprare (${check.missing.length}): ${check.missing
          .map((m) => (m.quantity ? `${m.name} (${m.quantity})` : m.name))
          .join(', ')}.`
      : 'La lista è vuota: preso tutto.',
  ]
  return parts.filter(Boolean).join(' ')
}
