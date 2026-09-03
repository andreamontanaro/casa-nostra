import { getCurrentUser } from '@/lib/queries'
import { runAssistant, type AssistantMessage } from '@/lib/assistant/run'

// Serve il runtime Node: scarichiamo i byte degli allegati e usiamo l'SDK Gemini.
export const runtime = 'nodejs'
export const maxDuration = 60

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

  let messages: AssistantMessage[]
  try {
    const body = await request.json()
    messages = Array.isArray(body?.messages) ? body.messages : []
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  if (messages.length === 0) {
    return Response.json({ error: 'Nessun messaggio.' }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (text: string) => controller.enqueue(encoder.encode(text))
      try {
        await runAssistant({
          messages,
          userId: user.id,
          channel: 'app',
          apiKey,
          onText: write,
          onAction: (action) => write(ACTION_OPEN + action + ACTION_CLOSE),
          // Spesa creata o eliminata: segnala al client di rinfrescare la pagina sottostante.
          onExpenseCreated: () => write(REFRESH_SENTINEL),
          onExpenseDeleted: () => write(REFRESH_SENTINEL),
        })
        controller.close()
      } catch {
        write('\n\n⚠️ Si è verificato un errore con l\'assistente. Riprova tra poco.')
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
