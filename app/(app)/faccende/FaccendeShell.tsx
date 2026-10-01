'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { Lightbulb, Plus } from 'lucide-react'
import { AddChoreSheet, type AddChoreMode, type AddChoreValues } from '@/components/chores/AddChoreSheet'
import { ChoreBottle } from '@/components/chores/ChoreBottle'
import { TiltPrompt } from '@/components/chores/TiltPrompt'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import {
  acceptChoreHintAction,
  addChoreAction,
  addChoreHintAction,
  addChorePresetAction,
  deleteChoreAction,
  deleteChorePresetAction,
  dismissRecentChoreAction,
  removeChoreHintAction,
  restoreRecentChoreAction,
} from '@/app/actions/chores'
import {
  bottleNotches,
  overflowHints,
  parityMessage,
  shiftDay,
  type ChoreBalance,
  type NotchEntry,
  type NotchHint,
} from '@/lib/chores/bottle'
import { CHORE_PRESET_GROUPS, type CustomChorePreset } from '@/lib/chores/presets'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { ChoreEntry, ChoreHint } from '@/lib/queries'

const DAY_LABEL = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Rome',
})

const OFFLINE = 'Connessione interrotta. Riprova tra un momento.'

interface FaccendeShellProps {
  viewerId: string
  today: string
  balances: ChoreBalance[]
  entries: ChoreEntry[]
  suggestions: string[]
  customPresets: CustomChorePreset[]
  /** I suggerimenti di oggi, per entrambi. */
  hints: ChoreHint[]
}

/**
 * Le due bottiglie affiancate, il messaggio della parità sotto e, più in
 * basso, i giorni scorsi. Niente notifiche e niente numeri di "punteggio":
 * l'unica cosa che conta è se le bottiglie sono allo stesso livello.
 *
 * Segnare una faccenda non chiede conferma (si annulla dal toast), come
 * aggiungere alla lista della spesa; eliminarla sì.
 *
 * I suggerimenti: il "+" sulla bottiglia dell'altra persona manda un nome
 * che compare sbiadito nella sua prima tacca libera. Chi lo riceve lo
 * conferma (diventa una faccenda), lo scarta, o fa altro — e allora il
 * suggerimento sale di una tacca. Scade a mezzanotte, nessuna notifica.
 */
export function FaccendeShell({
  viewerId,
  today,
  balances,
  entries,
  suggestions,
  customPresets,
  hints,
}: FaccendeShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetKey, setSheetKey] = useState(0)
  const [sheetDoneBy, setSheetDoneBy] = useState(viewerId)
  const [sheetMode, setSheetMode] = useState<AddChoreMode>('fatto')
  const [selectedHint, setSelectedHint] = useState<ChoreHint | null>(null)
  const [hintBusy, setHintBusy] = useState(false)
  const [selected, setSelected] = useState<ChoreEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  // La tacca si riempie al tocco; se il salvataggio fallisce, a fine
  // transizione torna vuota da sola.
  const [, startAdd] = useTransition()
  const [shownEntries, addOptimistic] = useOptimistic<ChoreEntry[], ChoreEntry>(
    entries,
    (current, entry) => [...current, entry],
  )
  const [shownHints, changeHints] = useOptimistic<ChoreHint[], { add?: ChoreHint; remove?: string }>(
    hints,
    (current, { add, remove }) => [...current.filter((h) => h.id !== remove), ...(add ? [add] : [])],
  )

  // Chi non lavora da casa a sinistra, come nello schizzo.
  const people = [...balances].sort((a, b) => Number(a.worksFromHome) - Number(b.worksFromHome))
  const nameOf = (id: string) => balances.find((b) => b.userId === id)?.displayName ?? 'Qualcuno'
  const message = parityMessage(balances, viewerId)

  const todayEntries = shownEntries.filter((e) => e.done_on === today)
  const pastDays = [...new Set(shownEntries.filter((e) => e.done_on < today).map((e) => e.done_on))]
    .sort()
    .reverse()

  const other = people.find((p) => p.userId !== viewerId)
  const hintsFor = (userId: string) => shownHints.filter((h) => h.for_user === userId)

  function openSheet(doneBy: string, mode: AddChoreMode = 'fatto') {
    setSheetDoneBy(mode === 'suggerisci' ? viewerId : doneBy)
    setSheetMode(mode)
    setSheetKey((k) => k + 1)
    setSheetOpen(true)
  }

  function handleAdd(values: AddChoreValues) {
    setSheetOpen(false)
    if (values.mode === 'suggerisci') return handleSuggest(values)
    const doneOn = values.day === 'oggi' ? today : shiftDay(today, -1)
    startAdd(async () => {
      addOptimistic({
        id: `tmp-${Date.now()}`,
        name: values.name,
        done_by: values.doneBy,
        done_on: doneOn,
        created_by: viewerId,
        created_at: new Date().toISOString(),
      })
      const [result, preset] = await Promise.all([
        addChoreAction({ name: values.name, doneBy: values.doneBy, doneOn })
          .catch(() => ({ error: OFFLINE, id: undefined })),
        values.saveToGroup
          ? addChorePresetAction({ name: values.name, groupId: values.saveToGroup })
            .catch(() => ({ error: OFFLINE, id: undefined }))
          : null,
      ])
      // L'azione nuova è un di più: se non si salva lo si dice, ma la tacca resta.
      if (preset?.error) toast.error(preset.error)
      if (result.error || !result.id) {
        toast.error(result.error ?? OFFLINE)
        return
      }
      const id = result.id
      const whose = values.doneBy === viewerId ? '' : ` per ${nameOf(values.doneBy)}`
      const savedTo = preset && !preset.error ? CHORE_PRESET_GROUPS.find((g) => g.id === values.saveToGroup) : null
      const extra = savedTo ? ` e aggiunta a ${savedTo.icon} ${savedTo.label}` : ''
      toast.success(`"${values.name}" segnata${whose}${values.day === 'ieri' ? ', ieri' : ''}${extra}.`, {
        action: {
          label: 'Annulla',
          onClick: async () => {
            const undo = await deleteChoreAction(id).catch(() => ({ error: OFFLINE }))
            if (undo.error) toast.error(undo.error)
          },
        },
      })
    })
  }

  function handleSuggest(values: AddChoreValues) {
    startAdd(async () => {
      changeHints({
        add: {
          id: `tmp-${Date.now()}`,
          name: values.name,
          for_user: values.doneBy,
          from_user: viewerId,
          hint_on: today,
          created_at: new Date().toISOString(),
        },
      })
      const [result, preset] = await Promise.all([
        addChoreHintAction({ name: values.name, forUser: values.doneBy }).catch(() => ({ error: OFFLINE, id: undefined })),
        values.saveToGroup
          ? addChorePresetAction({ name: values.name, groupId: values.saveToGroup }).catch(() => ({ error: OFFLINE }))
          : null,
      ])
      if (preset?.error) toast.error(preset.error)
      if (result.error || !result.id) {
        toast.error(result.error ?? OFFLINE)
        return
      }
      const id = result.id
      toast.success(`Suggerito a ${nameOf(values.doneBy)}: "${values.name}".`, {
        action: {
          label: 'Annulla',
          onClick: async () => {
            const undo = await removeChoreHintAction(id).catch(() => ({ error: OFFLINE }))
            if (undo.error) toast.error(undo.error)
          },
        },
      })
    })
  }

  function handleHintTap(hint: NotchHint) {
    if (hint.id.startsWith('tmp-')) return
    const full = shownHints.find((h) => h.id === hint.id)
    if (full) setSelectedHint(full)
  }

  /** "Fatto!": il suggerimento diventa una faccenda, con la tacca piena subito. */
  function handleAcceptHint(hint: ChoreHint) {
    setSelectedHint(null)
    startAdd(async () => {
      changeHints({ remove: hint.id })
      addOptimistic({
        id: `tmp-${Date.now()}`,
        name: hint.name,
        done_by: hint.for_user,
        done_on: today,
        created_by: viewerId,
        created_at: new Date().toISOString(),
      })
      const result = await acceptChoreHintAction(hint.id).catch(() => ({ error: OFFLINE, entryId: undefined }))
      if (result.error || !result.entryId) {
        toast.error(result.error ?? OFFLINE)
        return
      }
      const entryId = result.entryId
      toast.success(`"${hint.name}" fatta.`, {
        action: {
          label: 'Annulla',
          onClick: async () => {
            const undo = await deleteChoreAction(entryId).catch(() => ({ error: OFFLINE }))
            if (undo.error) toast.error(undo.error)
          },
        },
      })
    })
  }

  /** Scarta (chi lo riceve) o ritira (chi l'ha mandato): il suggerimento sparisce. */
  async function handleRemoveHint(hint: ChoreHint) {
    setHintBusy(true)
    const result = await removeChoreHintAction(hint.id).catch(() => ({ error: OFFLINE }))
    setHintBusy(false)
    setSelectedHint(null)
    if (result.error) toast.error(result.error)
    else toast.success(hint.from_user === viewerId ? 'Suggerimento ritirato.' : 'Suggerimento scartato.')
  }

  async function handleCreatePreset(name: string, groupId: string): Promise<boolean> {
    const result = await addChorePresetAction({ name, groupId }).catch(() => ({ error: OFFLINE }))
    if (result.error) {
      toast.error(result.error)
      return false
    }
    const group = CHORE_PRESET_GROUPS.find((g) => g.id === groupId)
    toast.success(`"${name.trim()}" aggiunta a ${group?.icon ?? ''} ${group?.label ?? ''}.`)
    return true
  }

  async function handleDeletePreset(preset: CustomChorePreset) {
    const result = await deleteChorePresetAction(preset.id).catch(() => ({ error: OFFLINE }))
    if (result.error) toast.error(result.error)
    else toast.success(`"${preset.name}" tolta dalle azioni.`)
  }

  async function handleDismissRecent(name: string) {
    const result = await dismissRecentChoreAction(name).catch(() => ({ error: OFFLINE }))
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(`"${name}" tolta dai recenti.`, {
      action: {
        label: 'Annulla',
        onClick: async () => {
          const undo = await restoreRecentChoreAction(name).catch(() => ({ error: OFFLINE }))
          if (undo.error) toast.error(undo.error)
        },
      },
    })
  }

  function handleEntryTap(entry: NotchEntry) {
    // Una tacca appena riempita non ha ancora un id vero.
    if (entry.id.startsWith('tmp-')) return
    const full = shownEntries.find((e) => e.id === entry.id)
    if (full) setSelected(full)
  }

  async function handleDelete() {
    if (!selected) return
    setDeleting(true)
    const result = await deleteChoreAction(selected.id).catch(() => ({ error: OFFLINE }))
    setDeleting(false)
    setSelected(null)
    if (result.error) toast.error(result.error)
    else toast.success('Faccenda eliminata.')
  }

  const canDelete = !!selected && (selected.done_by === viewerId || selected.created_by === viewerId)

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-24 lg:pb-8">
      <header className="relative px-1">
        <h1 className="font-display text-3xl font-semibold text-foreground">Faccende di casa</h1>
        <div className="absolute top-1/2 right-0 -translate-y-1/2">
          <TiltPrompt />
        </div>
      </header>

      {/* Su desktop due colonne, come la home: le bottiglie a sinistra, ferme mentre si
          scorrono i giorni scorsi, e tutto il resto a destra. Le bottiglie hanno una
          larghezza massima: allargate, la spalla disegnata in SVG si deformerebbe. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-3 lg:sticky lg:top-24">
          <div className="mx-auto grid w-full max-w-md grid-cols-2 items-start gap-4 sm:gap-8">
            {people.map((person) => {
              const mine = todayEntries.filter((e) => e.done_by === person.userId)
              const isOther = person.userId !== viewerId
              return (
                <ChoreBottle
                  key={person.userId}
                  name={person.displayName}
                  notches={bottleNotches(mine, person.todayCapacity, person.todayBonus, hintsFor(person.userId))}
                  onEntryTap={handleEntryTap}
                  onHintTap={handleHintTap}
                  onAdd={() => openSheet(person.userId, isOther ? 'suggerisci' : 'fatto')}
                  addLabel={isOther ? `Suggerisci una faccenda a ${person.displayName}` : undefined}
                />
              )
            })}
          </div>

          {/* Suggerimenti rimasti senza tacca: la bottiglia si è riempita dopo che sono arrivati. */}
          {people.map((person) => {
            const extra = overflowHints(
              todayEntries.filter((e) => e.done_by === person.userId).length,
              person.todayCapacity,
              hintsFor(person.userId),
            )
            if (extra.length === 0) return null
            return (
              <div key={person.userId} className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted">
                <span>Non ci stanno più nella bottiglia di {person.displayName}:</span>
                {extra.map((hint) => (
                  <button
                    key={hint.id}
                    type="button"
                    onClick={() => handleHintTap(hint)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-full border border-dashed border-accent/50 px-3 text-accent-soft/80"
                  >
                    <Lightbulb className="size-3" aria-hidden />
                    {hint.name}
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-6">
          <Card
            role="status"
            className={cn(
              'flex flex-col gap-1 px-5 py-4 text-center',
              message.kind === 'pari' && 'bg-accent-muted/60',
            )}
          >
            <p className="font-display text-xl font-semibold text-foreground">
              {message.kind === 'pari' ? `😊 ${message.title}` : message.title}
            </p>
            {message.details.map((line) => (
              <p key={line} className="text-sm text-muted">{line}</p>
            ))}
          </Card>

          <div className="flex flex-col gap-3">
            <Button size="lg" onClick={() => openSheet(viewerId)} className="w-full">
              <Plus className="size-5" aria-hidden />
              Ho fatto una faccenda
            </Button>
            {other && (
              <Button variant="secondary" onClick={() => openSheet(other.userId, 'suggerisci')} className="w-full">
                <Lightbulb className="size-5" aria-hidden />
                Suggerisci a {other.displayName}
              </Button>
            )}
          </div>

          {pastDays.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="px-1 text-sm font-semibold text-muted">Giorni scorsi</h2>
              {pastDays.map((day) => (
                <Card key={day} className="flex flex-col gap-3 px-4 py-4">
                  <p className="text-sm font-semibold text-foreground first-letter:uppercase">
                    {day === shiftDay(today, -1) ? 'Ieri' : DAY_LABEL.format(new Date(`${day}T12:00:00Z`))}
                  </p>
                  {people.map((person) => {
                    const done = shownEntries.filter((e) => e.done_on === day && e.done_by === person.userId)
                    return (
                      <div key={person.userId} className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted">
                          {person.displayName} · {done.length}
                        </span>
                        {done.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {done.map((e) => (
                              <button
                                key={e.id}
                                type="button"
                                onClick={() => handleEntryTap(e)}
                                className="min-h-11 rounded-full bg-surface-raised px-3 text-sm text-foreground active:scale-[0.97]"
                              >
                                {e.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </Card>
              ))}
            </section>
          )}
        </div>
      </div>

      <AddChoreSheet
        key={sheetKey}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        people={people.map((p) => ({
          id: p.userId,
          label: p.userId === viewerId ? `Io (${p.displayName})` : p.displayName,
          fullToday: todayEntries.filter((e) => e.done_by === p.userId).length >= p.todayCapacity,
          hintRoom:
            p.todayCapacity -
            todayEntries.filter((e) => e.done_by === p.userId).length -
            hintsFor(p.userId).length,
        }))}
        viewerId={viewerId}
        initialMode={sheetMode}
        initialDoneBy={sheetDoneBy}
        recent={suggestions}
        custom={customPresets}
        onSubmit={handleAdd}
        onCreatePreset={handleCreatePreset}
        onDeletePreset={handleDeletePreset}
        onDismissRecent={handleDismissRecent}
      />

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        description={selected ? describe(selected, today, nameOf) : undefined}
        confirmLabel="Elimina"
        confirmVariant="destructive"
        onConfirm={canDelete ? handleDelete : undefined}
        loading={deleting}
      >
        {selected && !canDelete && (
          <p className="text-sm text-muted">
            Solo chi l’ha fatta o chi l’ha segnata può eliminarla.
          </p>
        )}
      </Dialog>

      {/* Chi riceve: "Fatto!" (diventa una faccenda), scarta, o fa altro.
          Chi l'ha mandato: lo ritira. */}
      {selectedHint && selectedHint.for_user === viewerId ? (
        <Dialog
          open
          onClose={() => setSelectedHint(null)}
          title={`${nameOf(selectedHint.from_user)} ti suggerisce`}
          description={`«${selectedHint.name}». Se nel frattempo fai altro, il suggerimento sale alla tacca dopo.`}
          confirmLabel="Fatto!"
          onConfirm={() => handleAcceptHint(selectedHint)}
          loading={hintBusy}
        >
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full"
              disabled={hintBusy}
              onClick={() => {
                setSelectedHint(null)
                openSheet(viewerId)
              }}
            >
              Ho fatto un’altra cosa
            </Button>
            <Button variant="ghost" className="w-full" disabled={hintBusy} onClick={() => handleRemoveHint(selectedHint)}>
              Scarta il suggerimento
            </Button>
          </div>
        </Dialog>
      ) : (
        <Dialog
          open={!!selectedHint}
          onClose={() => setSelectedHint(null)}
          title={selectedHint ? `Hai suggerito a ${nameOf(selectedHint.for_user)}` : ''}
          description={
            selectedHint
              ? `«${selectedHint.name}». Resta finché non lo conferma o lo scarta, al massimo fino a mezzanotte.`
              : undefined
          }
          confirmLabel="Ritira"
          confirmVariant="destructive"
          onConfirm={selectedHint ? () => handleRemoveHint(selectedHint) : undefined}
          loading={hintBusy}
        />
      )}
    </div>
  )
}

function describe(entry: ChoreEntry, today: string, nameOf: (id: string) => string): string {
  const when =
    entry.done_on === today
      ? 'oggi'
      : entry.done_on === shiftDay(today, -1)
        ? 'ieri'
        : DAY_LABEL.format(new Date(`${entry.done_on}T12:00:00Z`))
  const by = `Fatta da ${nameOf(entry.done_by)} ${when}`
  return entry.created_by === entry.done_by ? `${by}.` : `${by}, segnata da ${nameOf(entry.created_by)}.`
}
