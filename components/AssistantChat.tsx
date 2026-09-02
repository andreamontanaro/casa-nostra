'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { Sparkles, X, Send } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { Markdown } from '@/components/ui/Markdown'
import { toast } from '@/lib/toast'
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
  'Cosa ho comprato ieri?',
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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, action])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250)
  }, [open])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

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
        toast.error('Sessione scaduta. Ricarica la pagina e riprova.')
        setLoading(false)
        return
      }

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'Assistente non disponibile al momento.')
        setLoading(false)
        return
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
          setLoading(false)
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
    } catch {
      toast.error('Errore di rete con l\'assistente.')
      setLoading(false)
      setAction(null)
    }
  }

  return (
    <>
      {/* Nuvoletta flottante, sopra il FAB / la bottom nav */}
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Apri l'assistente"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.2 }}
        whileTap={{ scale: 0.92 }}
        className={cn(
          // right-5 (1.25rem) allinea il centro di questo bottone (size-12) a
          // quello del FAB (right-4 + size-14); bottom 10rem lascia ~1rem di gap
          // sopra il FAB, che termina a 9rem dal fondo.
          'fixed right-5 z-40',
          'bottom-[calc(10rem+env(safe-area-inset-bottom))]',
          'flex size-12 items-center justify-center rounded-full',
          'bg-surface text-accent border border-border shadow-card',
        )}
      >
        <Sparkles className="size-5" strokeWidth={2.25} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="assistant-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              key="assistant-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className={cn(
                'fixed inset-x-0 bottom-0 z-50 flex h-[88svh] flex-col',
                'rounded-t-[28px] border-t border-border/60 bg-surface shadow-dialog',
              )}
            >
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent-muted text-accent-soft">
                  <Sparkles className="size-5" strokeWidth={2.25} />
                </span>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-foreground">Assistente</h2>
                  <p className="text-xs text-muted">Le tue spese, spiegate</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Chiudi"
                  className="flex size-9 items-center justify-center rounded-full text-muted transition-[background-color,transform] hover:bg-surface-raised hover:text-foreground active:scale-95"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Messaggi */}
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-raised px-4 py-2.5 text-sm text-foreground">
                    {greeting}
                  </div>
                </div>

                {messages.length === 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground transition-[background-color,transform] hover:bg-surface-raised active:scale-95"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] px-4 py-2.5 text-sm',
                        m.role === 'user'
                          ? 'whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent text-accent-foreground'
                          : 'rounded-2xl rounded-bl-md bg-surface-raised text-foreground',
                      )}
                    >
                      {m.role === 'assistant' ? (
                        m.text ? (
                          <Markdown onNavigate={() => setOpen(false)}>{m.text}</Markdown>
                        ) : (
                          <span className="text-muted">…</span>
                        )
                      ) : (
                        m.text
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-surface-raised px-4 py-3 text-muted">
                      <Spinner size="sm" />
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={action ?? '__thinking__'}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="text-xs"
                        >
                          {action ?? 'Sto pensando…'}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  send(input)
                }}
                className="flex items-end gap-2 border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Scrivi una domanda…"
                  inputMode="text"
                  enterKeyHint="send"
                  className={cn(
                    'h-11 flex-1 rounded-2xl border border-border bg-surface px-4 text-base text-foreground',
                    'placeholder:text-muted shadow-soft',
                    'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
                  )}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  aria-label="Invia"
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-2xl',
                    'bg-accent text-accent-foreground shadow-soft transition-[opacity,transform]',
                    'active:scale-95 disabled:opacity-40 disabled:active:scale-100',
                  )}
                >
                  <Send className="size-5" strokeWidth={2.25} />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
