import { GoogleGenAI, Type, type Content, type Part, type FunctionCall } from '@google/genai'
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

// Serve il runtime Node: scarichiamo i byte degli allegati e usiamo l'SDK Gemini.
export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest'
const MAX_TURNS = 5

type IncomingMessage = { role: 'user' | 'model'; text: string }

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
    },
    required: ['expense_id'],
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
    tools: [{ functionDeclarations: [getAttachmentsTool] }],
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
        `- ${p.display_name}${p.id === currentUserId ? ' (è chi ti sta scrivendo, "io"/"tu")' : ''}` +
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
