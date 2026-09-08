'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Markdown } from '@/components/ui/Markdown'
import { ASSISTANT_OPEN_EVENT } from '@/lib/assistant/ui'
import { cn } from '@/lib/utils'

type ChatMessage = { role: 'user' | 'assistant'; text: string }

// Stesso marcatore emesso dal route /api/assistant quando crea una spesa: lo
// rimuoviamo dal testo e lo usiamo per rinfrescare la pagina sottostante.
const NUL = String.fromCharCode(0)
const REFRESH_SENTINEL = `${NUL}REFRESH${NUL}`
// Marcatori che racchiudono il testo dell'azione in corso (vedi /api/assistant):
// fra ACTION_OPEN e ACTION_CLOSE c'è la frase da mostrare al posto di "Sto pensando…".
const ACTION_OPEN = `${NUL}ACTION${NUL}`
const ACTION_CLOSE = `${NUL}/ACTION${NUL}`
// Marcatori "di controllo" che possono comparire nello stream: se il buffer termina
// con un loro prefisso parziale, aspettiamo altri dati prima di interpretarlo.
const CONTROL_MARKERS = [REFRESH_SENTINEL, ACTION_OPEN]

const EXPENSE_SUGGESTIONS = [
  'Cosa manca nella lista della spesa?',
  'Riepilogo delle spese di questo mese',
  'Chi deve quanto, in questo momento?',
  'Su cosa stiamo spendendo di più?',
]

const EXPENSE_GREETING =
  'Ciao! Sono l\'assistente di Casa Nostra. Posso aiutarti con le vostre spese: ' +
  'chiedimi un riepilogo, cosa avete comprato, chi deve quanto, o di guardare uno scontrino.'

export function AssistantChat() {
  const router = useRouter()

  const greeting = EXPENSE_GREETING
  const suggestions = EXPENSE_SUGGESTIONS

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  // Frase "in tempo reale" mostrata mentre l'assistente usa uno strumento; null = nessuna.
  const [action, setAction] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const inFlight = useRef(false)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: 'end', behavior: 'instant' })
  }, [messages, loading, action])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || inFlight.current) return
    inFlight.current = true
    setFailure(null)

    const history: ChatMessage[] = [...messages, { role: 'user', text: trimmed }]
    setMessages(history)
    setInput('')
    setLoading(true)
    setAction(null)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            text: m.text,
          })),
        }),
      })

      if (res.redirected) {
        throw new Error('Sessione scaduta. Ricarica la pagina e riprova.')
      }

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Assistente non disponibile al momento.')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let started = false
      let needsRefresh = false

      // Appende testo "vero" alla bolla dell'assistente: al primo pezzo crea la bolla,
      // spegne lo spinner e azzera l'azione in corso.
      const appendText = (text: string) => {
        if (!text) return
        if (!started) {
          started = true
          setAction(null)
          setMessages((prev) => [...prev, { role: 'assistant', text }])
          return
        }
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, text: last.text + text }
          }
          return next
        })
      }

      // I marcatori di controllo (refresh, azioni) possono essere spezzati tra due
      // chunk: accumuliamo in un buffer ed estraiamo testo ed eventi un pezzo alla volta.
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let keepParsing = true
        while (keepParsing) {
          keepParsing = false
          const nul = buffer.indexOf(NUL)
          // Nessun marcatore in vista: tutto il buffer è testo.
          if (nul === -1) {
            appendText(buffer)
            buffer = ''
            break
          }
          // Emetti il testo che precede il marcatore.
          if (nul > 0) {
            appendText(buffer.slice(0, nul))
            buffer = buffer.slice(nul)
          }
          // Ora il buffer inizia con un NUL: prova a riconoscere un marcatore completo.
          if (buffer.startsWith(REFRESH_SENTINEL)) {
            needsRefresh = true
            buffer = buffer.slice(REFRESH_SENTINEL.length)
            keepParsing = true
          } else if (buffer.startsWith(ACTION_OPEN)) {
            const closeAt = buffer.indexOf(ACTION_CLOSE, ACTION_OPEN.length)
            if (closeAt === -1) break // frase non ancora completa: aspetta altri dati
            setAction(buffer.slice(ACTION_OPEN.length, closeAt))
            buffer = buffer.slice(closeAt + ACTION_CLOSE.length)
            keepParsing = true
          } else if (CONTROL_MARKERS.some((m) => m.startsWith(buffer))) {
            break // marcatore incompleto a fine buffer: aspetta altri dati
          } else {
            // NUL isolato non riconducibile a un marcatore: trattalo come testo.
            appendText(buffer[0])
            buffer = buffer.slice(1)
            keepParsing = true
          }
        }
      }
      // Flush di eventuale testo residuo (non un marcatore incompleto rimasto appeso).
      if (buffer && !buffer.startsWith(NUL)) appendText(buffer)
      // Se lo stream si chiude senza testo, evitiamo di lasciare lo spinner acceso.
      setLoading(false)
      setAction(null)
      // Una spesa è stata creata: aggiorna i Server Component della pagina sottostante.
      if (needsRefresh) router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connessione interrotta.'
      setFailure(message + ' Se avevi confermato una modifica, controlla il risultato prima di inviarla di nuovo.')
      setInput((current) => current || trimmed)
      router.refresh()
    } finally {
      inFlight.current = false
      setLoading(false)
      setAction(null)
    }
  }

  useEffect(() => {
    const openFromContext = (event: Event) => {
      const prompt = (event as CustomEvent<unknown>).detail
      if (typeof prompt === 'string') setInput(prompt)
      setOpen(true)
    }
    window.addEventListener(ASSISTANT_OPEN_EVENT, openFromContext)
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, openFromContext)
  }, [])

  return (
    <Sheet open={open} onOpenChange={setOpen} title="Assistente" description="Spese, saldo e lista, in parole semplici." size="full"
      footer={
        <form onSubmit={(e) => { e.preventDefault(); void send(input) }} className="flex items-end gap-2">
          <textarea ref={inputRef} data-autofocus aria-label="Messaggio per l’assistente" rows={2} value={input}
            onChange={(e) => setInput(e.target.value)} placeholder="Scrivi una domanda…" enterKeyHint="send"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input) } }}
            className="min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-border bg-surface px-3 py-3 text-base placeholder:text-muted" />
          <Button type="submit" disabled={loading || !input.trim()} aria-label="Invia messaggio" className="size-12 shrink-0 px-0"><Send className="size-5" aria-hidden /></Button>
        </form>
      }>
      <div className="space-y-4 px-4 py-3">
        <p className="rounded-2xl bg-accent-muted/50 p-4 text-sm leading-relaxed">{greeting}</p>
        {messages.length === 0 && <div className="grid gap-2">{suggestions.map((s) =>
          <button key={s} type="button" disabled={loading} onClick={() => void send(s)} className="min-h-12 rounded-2xl border border-border p-3 text-left text-sm hover:bg-surface-raised">{s}</button>)}</div>}
        <div role="log" aria-label="Conversazione" aria-live="polite" aria-busy={loading} className="space-y-3">
          {messages.map((m, i) => <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('min-w-0 max-w-full break-words rounded-2xl px-4 py-3 text-sm', m.role === 'user' ? 'ml-6 whitespace-pre-wrap rounded-br-md bg-accent text-accent-foreground' : 'w-full rounded-bl-md bg-surface-raised')}>
              <span className="sr-only">{m.role === 'user' ? 'Tu' : 'Assistente'}: </span>
              {m.role === 'assistant' ? <Markdown onNavigate={() => setOpen(false)}>{m.text || '…'}</Markdown> : m.text}
            </div>
          </div>)}
        </div>
        {loading && <div role="status" className="flex items-center gap-2 px-1 text-sm text-muted"><Spinner size="sm" />{action ?? 'Sto preparando la risposta…'}</div>}
        {failure && <p role="alert" className="rounded-2xl border border-border bg-surface p-4 text-sm">{failure}</p>}
        {messages.length > 0 && <Button variant="ghost" size="sm" disabled={loading} onClick={() => { setMessages([]); setFailure(null) }}>Nuova conversazione</Button>}
        <div ref={scrollRef} />
      </div>
    </Sheet>
  )
}
