import { GoogleGenAI, Type, type Content, type Part, type FunctionCall } from '@google/genai'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  getCurrentUser,
  getProfiles,
  getOpenBalance,
  getAllExpenses,
  getExpenseAttachments,
} from '@/lib/queries'
import { ACCEPTED_MIME } from '@/lib/attachments'
import {
  formatEur,
  formatDate,
  todayISO,
  CATEGORY_LABELS,
  SPLIT_LABELS,
} from '@/lib/fmt'
import { Constants } from '@/types/database'
import type { Database } from '@/types/database'

// Serve il runtime Node: scarichiamo i byte degli allegati e usiamo l'SDK Gemini.
export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest'
const MAX_TURNS = 5

// Marcatore non visibile inviato nello stream quando viene creata una spesa: il
// client lo intercetta per rinfrescare la pagina sottostante. Il NUL non è
// producibile dal modello in testo normale, quindi non rischia collisioni.
const NUL = String.fromCharCode(0)
const REFRESH_SENTINEL = `${NUL}REFRESH${NUL}`

// Marcatori che racchiudono il testo dell'azione in corso (es. "Sto visionando lo
// scontrino…"): il client li intercetta e mostra la frase al posto di "Sto pensando…".
// Anche qui il NUL evita collisioni con il testo prodotto dal modello.
const ACTION_OPEN = `${NUL}ACTION${NUL}`
const ACTION_CLOSE = `${NUL}/ACTION${NUL}`

// Descrizione condivisa del parametro "action" presente su ogni tool: una frase in
// prima persona mostrata in tempo reale all'utente mentre lo strumento lavora.
const actionParam = {
  type: Type.STRING,
  description:
    'Breve frase in prima persona, in italiano, che descrive in tempo reale all\'utente ' +
    'cosa stai facendo mentre usi questo strumento (es. "Sto visionando lo scontrino della ' +
    'spesa di ieri…" oppure "Sto aggiungendo la bolletta della luce…"). Viene mostrata come ' +
    'stato di caricamento, quindi scrivila sempre, concisa e con i puntini di sospensione finali.',
}

type IncomingMessage = { role: 'user' | 'model'; text: string }
type ExpenseCategory = Database['public']['Enums']['expense_category']
type SplitRule = Database['public']['Enums']['split_rule']

const VALID_CATEGORIES = Constants.public.Enums.expense_category
const VALID_SPLITS = Constants.public.Enums.split_rule

// Dichiarazione del tool: il modello la invoca quando vuole "vedere" uno scontrino.
const getAttachmentsTool = {
  name: 'get_attachments',
  description:
    'Recupera gli allegati (scontrini/ricevute, immagini o PDF) di una spesa specifica, ' +
    'identificata dal suo id, così da poterne leggere e descrivere il contenuto. ' +
    'Usalo solo quando l\'utente chiede esplicitamente di guardare uno scontrino o un dettaglio ' +
    'che richiede di vedere la ricevuta.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      expense_id: {
        type: Type.STRING,
        description: 'L\'id (UUID) della spesa di cui caricare gli allegati.',
      },
      action: actionParam,
    },
    required: ['expense_id'],
  },
}

// Dichiarazione del tool con cui il modello registra una nuova spesa condivisa.
// Da invocare SOLO dopo aver riepilogato la spesa e ottenuto conferma dall'utente.
const createExpenseTool = {
  name: 'create_expense',
  description:
    'Registra una NUOVA spesa condivisa nel database. Usalo solo quando l\'utente ha confermato ' +
    'esplicitamente di voler aggiungere la spesa e hai tutte le informazioni obbligatorie ' +
    '(importo, descrizione, categoria, chi ha pagato). Se manca qualcosa, chiedila prima; ' +
    'prima di chiamare il tool riepiloga la spesa e attendi un "sì" dell\'utente. ' +
    'category deve essere una tra: affitto, bolletta, spesa_alimentare, abbonamento, manutenzione, viaggi, altro. ' +
    'split_rule (facoltativo) tra: fifty_fifty, sixty_forty, custom; se non lo specifichi viene scelto in automatico ' +
    '(affitto = 50/50, tutto il resto = 60/40). expense_date facoltativo in formato YYYY-MM-DD (default: oggi). ' +
    'paid_by deve essere l\'UUID esatto di una delle persone elencate in PERSONE.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      amount: {
        type: Type.NUMBER,
        description: 'Importo totale della spesa in euro, maggiore di zero.',
      },
      description: {
        type: Type.STRING,
        description: 'Breve descrizione della spesa (es. "Spesa al Lidl").',
      },
      category: {
        type: Type.STRING,
        description:
          'Categoria: affitto | bolletta | spesa_alimentare | abbonamento | manutenzione | viaggi | altro.',
      },
      paid_by: {
        type: Type.STRING,
        description: 'UUID esatto della persona che ha pagato (vedi elenco PERSONE).',
      },
      split_rule: {
        type: Type.STRING,
        description: 'Facoltativo: fifty_fifty | sixty_forty | custom.',
      },
      expense_date: {
        type: Type.STRING,
        description: 'Facoltativo: data in formato YYYY-MM-DD. Default: oggi.',
      },
      custom_other_share: {
        type: Type.NUMBER,
        description:
          'Obbligatorio solo se split_rule = "custom": quota in euro a carico dell\'altra persona (deve essere minore dell\'importo totale).',
      },
      action: actionParam,
    },
    required: ['amount', 'description', 'category', 'paid_by'],
  },
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'Assistente non configurato: manca la chiave API di Gemini.' },
      { status: 503 },
    )
  }

  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Non autenticato.' }, { status: 401 })
  }

  let messages: IncomingMessage[]
  try {
    const body = await request.json()
    messages = Array.isArray(body?.messages) ? body.messages : []
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  if (messages.length === 0) {
    return Response.json({ error: 'Nessun messaggio.' }, { status: 400 })
  }

  let systemInstruction: string
  try {
    systemInstruction = await buildSystemInstruction(user.id)
  } catch {
    return Response.json(
      { error: 'Impossibile leggere i dati delle spese.' },
      { status: 500 },
    )
  }

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
        functionDeclarations: [getAttachmentsTool, createExpenseTool],
      },
    ],
    temperature: 0.4,
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let turn = 0
        while (turn++ < MAX_TURNS) {
          const result = await ai.models.generateContentStream({
            model: MODEL,
            contents,
            config,
          })

          // Accumuliamo le part così come arrivano dal modello: le function call
          // di Gemini 3.x portano un `thoughtSignature` che DEVE essere rimandato
          // indietro intatto, quindi non ricostruiamo il turno da zero.
          // Bufferizziamo il testo del turno: lo inviamo al client SOLO se questo
          // turno non contiene function call. Nei turni in cui il modello chiama un
          // tool capita che emetta testo di servizio (es. il nome del file) che non
          // deve finire in chat.
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

          // Nessuna chiamata a funzione: è la risposta finale, la inviamo al client.
          if (turnCalls.length === 0) {
            if (turnText) controller.enqueue(encoder.encode(turnText))
            break
          }

          // Registra il turno del modello (part originali, firma inclusa) e risolvi i tool.
          contents.push({ role: 'model', parts: modelParts })

          const responseParts: Part[] = []
          for (const call of turnCalls) {
            // Mostra all'utente cosa sta facendo l'assistente PRIMA di eseguire il
            // tool (così la frase compare mentre lo strumento lavora).
            const action = String(
              (call.args as Record<string, unknown> | undefined)?.action ?? '',
            ).trim()
            if (action) {
              controller.enqueue(encoder.encode(ACTION_OPEN + action + ACTION_CLOSE))
            }

            if (call.name === 'get_attachments') {
              const expenseId = String(
                (call.args as Record<string, unknown> | undefined)?.expense_id ?? '',
              )
              const { summary, media } = await loadAttachmentParts(expenseId)
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
                user.id,
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
              // Spesa creata: segnala al client di rinfrescare la pagina sottostante.
              if (result.ok) {
                controller.enqueue(encoder.encode(REFRESH_SENTINEL))
              }
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
        controller.close()
      } catch {
        controller.enqueue(
          encoder.encode(
            '\n\n⚠️ Si è verificato un errore con l\'assistente. Riprova tra poco.',
          ),
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * Costruisce la system instruction iniettando profili, saldo corrente e l'elenco
 * completo delle spese (con marcatore per quelle che hanno allegati).
 */
async function buildSystemInstruction(currentUserId: string): Promise<string> {
  const [profiles, balance, expenses, attachmentExpenseIds] = await Promise.all([
    getProfiles(),
    getOpenBalance(),
    getAllExpenses(),
    getExpenseIdsWithAttachments(),
  ])

  const me = profiles.find((p) => p.id === currentUserId)
  const meName = me?.display_name ?? 'l\'utente corrente'

  const profileLines = profiles
    .map(
      (p) =>
        `- ${p.display_name} (id: ${p.id})${p.id === currentUserId ? ' — è chi ti sta scrivendo ("io"/"tu")' : ''}` +
        `${p.higher_income ? ' — reddito maggiore, paga il 60% nelle spese 60/40' : ''}`,
    )
    .join('\n')

  // Riepilogo del saldo dalla vista v_user_open_balance (mai ricalcolato a mano).
  let balanceSummary = 'Al momento i conti sono in pari.'
  const creditor = balance.find((r) => (r.net_position ?? 0) > 0.005)
  const debtor = balance.find((r) => (r.net_position ?? 0) < -0.005)
  if (creditor && debtor) {
    balanceSummary = `${debtor.display_name} deve ${formatEur(
      Math.abs(debtor.net_position ?? 0),
    )} a ${creditor.display_name}.`
  }

  const expenseLines = expenses.length
    ? expenses
        .map((e) => {
          const cat = CATEGORY_LABELS[e.category] ?? e.category
          const split = SPLIT_LABELS[e.split_rule] ?? e.split_rule
          const paidBy = e.paid_by_profile?.display_name ?? '?'
          const stato = e.settlement_id ? 'saldata' : 'aperta'
          const att = attachmentExpenseIds.has(e.id) ? ' 📎scontrino' : ''
          return `- [${e.id}] ${e.expense_date} | "${e.description}" | ${formatEur(
            e.amount,
          )} | ${cat} | ${split} | pagata da ${paidBy} | ${stato}${att}`
        })
        .join('\n')
    : '(nessuna spesa registrata)'

  return [
    'Sei l\'assistente IA di "Casa Nostra", un\'app con cui due conviventi gestiscono le spese di casa.',
    `Stai parlando con ${meName}. Rispondi sempre in italiano, in tono amichevole e conciso.`,
    '',
    'REGOLE DI DIVISIONE: l\'affitto si divide 50/50, tutto il resto 60/40 (chi ha il reddito maggiore paga il 60%). Esiste anche una divisione personalizzata.',
    '',
    'PERSONE:',
    profileLines,
    '',
    'SALDO CORRENTE (solo spese aperte, non saldate):',
    balanceSummary,
    '',
    `DATA DI OGGI: ${todayISO()} (${formatDate(todayISO())}). Usala per interpretare "ieri", "l\'altro ieri", "questa settimana", ecc.`,
    '',
    'ELENCO SPESE (la più recente in alto). Formato: [id] data | descrizione | importo | categoria | divisione | pagata da | stato.',
    'Le spese con 📎scontrino hanno un allegato che puoi guardare con lo strumento get_attachments passando il loro id.',
    expenseLines,
    '',
    'ISTRUZIONI:',
    '- Importi sempre in euro con la virgola decimale (es. 12,50 €); date in formato italiano.',
    '- Per il saldo usa i dati forniti sopra, non ricalcolarlo da solo.',
    '- Quando l\'utente chiede di vedere/leggere uno scontrino, o un dettaglio che richiede la ricevuta, chiama get_attachments con l\'id della spesa pertinente.',
    '- Se una spesa non ha 📎scontrino, dillo chiaramente invece di inventare.',
    '- Sii utile per riepiloghi, confronti, considerazioni e consigli sull\'uso dei soldi, restando basato sui dati reali.',
    '- Ogni volta che usi uno strumento (get_attachments, create_expense) compila SEMPRE il parametro "action": una breve frase in prima persona che descrive cosa stai facendo (es. "Sto visionando lo scontrino della spesa di ieri…"). Viene mostrata all\'utente come stato di caricamento mentre lo strumento lavora.',
    '',
    'AGGIUNGERE UNA SPESA (tool create_expense):',
    '- Usalo quando l\'utente chiede di aggiungere/registrare/segnare una spesa.',
    '- Servono sempre: importo, descrizione, categoria e chi ha pagato (paid_by = l\'id esatto della persona dall\'elenco PERSONE). "io"/"ho pagato io" = l\'id di chi ti sta scrivendo.',
    '- Se manca un\'informazione obbligatoria, CHIEDILA; non inventare importi, pagante o categoria.',
    '- PRIMA di chiamare il tool, RIEPILOGA la spesa (importo, descrizione, categoria, chi ha pagato, divisione, data) e chiedi una conferma esplicita. Chiama create_expense SOLO dopo che l\'utente ha confermato (es. "sì", "ok", "conferma").',
    '- Categoria: scegli la più adatta tra le 7 disponibili; in dubbio usa "altro".',
    '- Divisione: NON passare split_rule a meno che l\'utente non lo chieda esplicitamente — il default è automatico (affitto = 50/50, tutto il resto = 60/40). Per una divisione personalizzata usa split_rule="custom" con custom_other_share.',
    '- Data: default oggi; converti "ieri"/"l\'altro ieri"/"il primo del mese" in formato YYYY-MM-DD usando la DATA DI OGGI.',
    '- Dopo la creazione, conferma in modo naturale cosa hai registrato e includi SEMPRE un link markdown per aprirla/modificarla, nella forma [Apri la spesa](/spese/ID), usando l\'expense_id che il tool ti restituisce.',
  ].join('\n')
}

async function getExpenseIdsWithAttachments(): Promise<Set<string>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expense_attachments')
    .select('expense_id')
  if (error || !data) return new Set()
  return new Set(data.map((r) => r.expense_id))
}

/**
 * Carica gli allegati di una spesa e li trasforma in part multimodali (inlineData)
 * per Gemini, più un riassunto testuale da restituire come functionResponse.
 */
async function loadAttachmentParts(
  expenseId: string,
): Promise<{ summary: string; media: Part[] }> {
  if (!expenseId) {
    return { summary: 'Id spesa mancante: impossibile recuperare gli allegati.', media: [] }
  }

  let attachments
  try {
    attachments = await getExpenseAttachments(expenseId)
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
): Promise<CreateExpenseResult> {
  const a = args ?? {}

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
  const profiles = await getProfiles()
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

  const supabase = await createClient()
  const { data: inserted, error } = await supabase
    .from('expenses')
    .insert({
      amount: Math.round(amount * 100) / 100,
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
  revalidatePath('/')
  revalidatePath('/spese')

  const catLabel = CATEGORY_LABELS[category] ?? category
  const splitLabel = SPLIT_LABELS[splitRule] ?? splitRule
  const summary =
    `Spesa creata: ${formatEur(amount)} — "${description}" (${catLabel}), ` +
    `divisione ${splitLabel}, pagata da ${payer.display_name}, data ${expenseDate}.`

  return { ok: true, expenseId: inserted.id, summary }
}
