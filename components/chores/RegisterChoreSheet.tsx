'use client'

import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Input } from '@/components/ui/Input'
import { Chip } from '@/components/ui/Chip'
import { Button } from '@/components/ui/Button'
import { ListRow } from '@/components/ui/ListRow'
import { ChoreIcon } from '@/components/ChoreIcon'
import { Spinner } from '@/components/ui/Spinner'
import { CHORE_AREA_LABELS, todayISO } from '@/lib/fmt'
import { completeChore, completeOneOffChore, estimateChoreXp } from '@/app/actions/chores'
import { toast } from '@/lib/toast'
import { Constants } from '@/types/database'
import type { ChoreStatusRow } from '@/lib/queries'

type ChoreArea = (typeof Constants.public.Enums.chore_area)[number]

const AREAS = Constants.public.Enums.chore_area

interface RegisterChoreSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: ChoreStatusRow[]
  onRegistered: (logId: string) => void
}

/**
 * Sheet del FAB: registra qualsiasi faccenda del catalogo (anche non ancora
 * scaduta, anche retrodatata) o una faccenda fuori catalogo. La lista "Da
 * fare" della schermata principale suggerisce un ordine, ma non filtra: da
 * qui si arriva a tutto il catalogo con una ricerca.
 */
export function RegisterChoreSheet({
  open,
  onOpenChange,
  templates,
  onRegistered,
}: RegisterChoreSheetProps) {
  const [query, setQuery] = useState('')
  const [useToday, setUseToday] = useState(true)
  const [customDate, setCustomDate] = useState(todayISO())
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [oneOffOpen, setOneOffOpen] = useState(false)
  const [oneOffName, setOneOffName] = useState('')
  const [oneOffArea, setOneOffArea] = useState<ChoreArea>('altro')
  const [oneOffXp, setOneOffXp] = useState('10')
  const [oneOffPending, setOneOffPending] = useState(false)
  const [estimating, setEstimating] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return templates
    return templates.filter((t) => (t.name ?? '').toLowerCase().includes(q))
  }, [query, templates])

  function reset() {
    setQuery('')
    setUseToday(true)
    setCustomDate(todayISO())
    setOneOffOpen(false)
    setOneOffName('')
    setOneOffArea('altro')
    setOneOffXp('10')
    setEstimating(false)
  }

  async function handleEstimate() {
    if (!oneOffName.trim()) {
      toast.error('Scrivi prima cosa hai fatto.')
      return
    }
    setEstimating(true)
    const result = await estimateChoreXp(oneOffName)
    setEstimating(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setOneOffArea(result.area)
    setOneOffXp(String(result.xp))
    toast.success(`Stimato: ${CHORE_AREA_LABELS[result.area]} · ${result.xp} XP`)
  }

  function doneAtIso(): string {
    if (useToday) return new Date().toISOString()
    // Data scelta a mezzogiorno locale: evita ambiguità di fuso sul confine
    // di giornata quando viene poi confrontata via ::date lato SQL.
    return new Date(`${customDate}T12:00:00`).toISOString()
  }

  async function handlePick(templateId: string) {
    setPendingId(templateId)
    const result = await completeChore(templateId, doneAtIso())
    setPendingId(null)
    if (result.error || !result.logId) {
      toast.error(result.error ?? 'Errore durante il salvataggio.')
      return
    }
    onRegistered(result.logId)
    reset()
    onOpenChange(false)
  }

  async function handleOneOff() {
    const xp = parseInt(oneOffXp, 10)
    if (!oneOffName.trim()) {
      toast.error('Inserisci un nome.')
      return
    }
    setOneOffPending(true)
    const result = await completeOneOffChore({
      name: oneOffName,
      area: oneOffArea,
      xp,
      doneAt: doneAtIso(),
    })
    setOneOffPending(false)
    if (result.error || !result.logId) {
      toast.error(result.error ?? 'Errore durante il salvataggio.')
      return
    }
    onRegistered(result.logId)
    reset()
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
      title="Registra una faccenda"
      size="auto"
    >
      <div className="flex flex-col gap-4 px-4 pb-4">
        <div className="flex items-center gap-2">
          <Chip variant="filter" active={useToday} onClick={() => setUseToday(true)}>
            Oggi
          </Chip>
          <Chip variant="filter" active={!useToday} onClick={() => setUseToday(false)}>
            Altra data
          </Chip>
          {!useToday && (
            <input
              type="date"
              value={customDate}
              max={todayISO()}
              onChange={(e) => setCustomDate(e.target.value)}
              className="h-9 flex-1 rounded-full border border-border-strong bg-surface px-3 text-sm text-foreground"
            />
          )}
        </div>

        <Input
          placeholder="Cerca nel catalogo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="-mx-1 max-h-64 overflow-y-auto rounded-2xl border border-border">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Nessuna faccenda trovata.</p>
          ) : (
            filtered.map((t) => (
              <ListRow
                key={t.id}
                leading={<ChoreIcon area={t.area ?? 'altro'} size="sm" />}
                title={t.name ?? ''}
                subtitle={`${CHORE_AREA_LABELS[t.area ?? 'altro']} · ${t.effort_xp ?? 0} XP`}
                onClick={() => handlePick(t.id!)}
                trailing={pendingId === t.id ? <Spinner size="sm" /> : undefined}
              />
            ))
          )}
        </div>

        <div className="border-t border-border pt-3">
          {!oneOffOpen ? (
            <Button variant="ghost" size="sm" onClick={() => setOneOffOpen(true)}>
              + Faccenda non in elenco
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              <Input
                label="Nome"
                placeholder="Es. Smontare la tenda del balcone"
                value={oneOffName}
                onChange={(e) => setOneOffName(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                loading={estimating}
                disabled={!oneOffName.trim()}
                onClick={handleEstimate}
              >
                <Sparkles className="size-3.5" strokeWidth={2.5} />
                Stima area e XP con l&apos;IA
              </Button>
              <div className="flex flex-wrap gap-2">
                {AREAS.map((a) => (
                  <Chip
                    key={a}
                    variant="filter"
                    active={oneOffArea === a}
                    onClick={() => setOneOffArea(a)}
                  >
                    {CHORE_AREA_LABELS[a]}
                  </Chip>
                ))}
              </div>
              <Input
                label="XP"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={oneOffXp}
                onChange={(e) => setOneOffXp(e.target.value)}
              />
              <Button onClick={handleOneOff} loading={oneOffPending}>
                Registra
              </Button>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}
