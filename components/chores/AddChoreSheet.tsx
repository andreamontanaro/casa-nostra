'use client'

import { useState } from 'react'
import { Check, Pencil, Plus, X } from 'lucide-react'
import { Chip } from '@/components/ui/Chip'
import { Dialog } from '@/components/ui/Dialog'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'
import { CHORE_NAME_MAX } from '@/lib/chores/bottle'
import {
  CHORE_PRESET_GROUPS,
  normalize,
  searchChoreNames,
  type CustomChorePreset,
} from '@/lib/chores/presets'
import { cn } from '@/lib/utils'

export type AddChoreMode = 'fatto' | 'suggerisci'

export interface AddChoreValues {
  /** `fatto` riempie una tacca; `suggerisci` manda il nome all'altra persona. */
  mode: AddChoreMode
  name: string
  doneBy: string
  day: 'oggi' | 'ieri'
  /** Se valorizzato, il nome scritto a mano diventa anche un'azione di quell'ambito. */
  saveToGroup?: string
}

interface Person {
  id: string
  label: string
  /** La bottiglia di oggi è piena: si può ancora segnare per ieri. */
  fullToday: boolean
  /** Tacche di oggi ancora libere anche dai suggerimenti. */
  hintRoom: number
}

interface AddChoreSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  people: Person[]
  viewerId: string
  initialMode: AddChoreMode
  initialDoneBy: string
  /** I nomi delle ultime faccende segnate, per la scheda "Recenti". */
  recent: string[]
  custom: CustomChorePreset[]
  onSubmit: (values: AddChoreValues) => void
  /** Crea un'azione; `true` se è andata, così il campo si svuota. */
  onCreatePreset: (name: string, groupId: string) => Promise<boolean>
  onDeletePreset: (preset: CustomChorePreset) => Promise<void>
  /** Toglie un nome dai recenti: nasconde, non cancella faccende. */
  onDismissRecent: (name: string) => void
}

const RECENT_TAB = 'recenti'
const LABEL = 'px-1 text-xs font-semibold uppercase tracking-wide text-muted'

/**
 * "Ho fatto una faccenda". Chi e quando hanno già il valore giusto (io, oggi)
 * e stanno in cima perché valgono per qualunque tocco sotto. Poi un campo
 * solo, che cerca tra le azioni o ne accetta una nuova, e le azioni per
 * ambito: **un tocco su un'azione riempie subito la tacca**, senza un secondo
 * bottone — l'errore si annulla dal toast.
 *
 * Non ci sono azioni predefinite: gli ambiti partono vuoti e le azioni le
 * create voi man mano, quindi il campo "Nuova azione" è sempre in vista
 * nell'ambito aperto. "Modifica" serve solo a eliminarle.
 *
 * Il form si rimonta a ogni apertura (key del chiamante): lo stato parte pulito.
 */
export function AddChoreSheet({
  open,
  onOpenChange,
  people,
  viewerId,
  initialMode,
  initialDoneBy,
  recent,
  custom,
  onSubmit,
  onCreatePreset,
  onDeletePreset,
  onDismissRecent,
}: AddChoreSheetProps) {
  const [mode, setMode] = useState<AddChoreMode>(initialMode)
  const [query, setQuery] = useState('')
  const [doneBy, setDoneBy] = useState(initialDoneBy)
  const [day, setDay] = useState<'oggi' | 'ieri'>('oggi')
  // Si apre sui recenti; senza storia, sul primo ambito che ha già azioni.
  const [tab, setTab] = useState(
    recent.length > 0
      ? RECENT_TAB
      : (CHORE_PRESET_GROUPS.find((g) => custom.some((c) => c.groupId === g.id)) ?? CHORE_PRESET_GROUPS[0]).id,
  )
  const [saveToGroup, setSaveToGroup] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [newPreset, setNewPreset] = useState('')
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<CustomChorePreset | null>(null)
  const [deleting, setDeleting] = useState(false)

  const other = people.find((p) => p.id !== viewerId)
  const suggesting = mode === 'suggerisci' && !!other
  const person = people.find((p) => p.id === doneBy)
  const blocked = suggesting ? (other?.hintRoom ?? 0) <= 0 : day === 'oggi' && !!person?.fullToday
  const typed = query.trim()
  const customNames = custom.map((c) => c.name)
  const results = searchChoreNames(typed, [...recent, ...customNames])
  const exactMatch = results.some((r) => normalize(r) === normalize(typed))

  function selectTab(id: string) {
    setTab(id)
    setEditing(false)
  }

  function save(name: string, group?: string) {
    if (blocked || !name.trim() || name.trim().length > CHORE_NAME_MAX) return
    onSubmit(
      suggesting
        ? { mode: 'suggerisci', name: name.trim(), doneBy: other!.id, day: 'oggi', saveToGroup: group }
        : { mode: 'fatto', name: name.trim(), doneBy, day, saveToGroup: group },
    )
  }

  function submitTyped(event: React.FormEvent) {
    event.preventDefault()
    save(typed, !exactMatch && saveToGroup ? saveToGroup : undefined)
  }

  async function createPreset(event: React.FormEvent) {
    event.preventDefault()
    const name = newPreset.trim()
    if (!name || tab === RECENT_TAB) return
    setCreating(true)
    const ok = await onCreatePreset(name, tab)
    setCreating(false)
    if (ok) setNewPreset('')
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    await onDeletePreset(toDelete)
    setDeleting(false)
    setToDelete(null)
  }

  const group = CHORE_PRESET_GROUPS.find((g) => g.id === tab)
  const tabCustom = custom.filter((c) => c.groupId === tab)

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={suggesting ? `Suggerisci a ${other!.label}` : 'Ho fatto una faccenda'}
      size="full"
    >
      {/* Il corpo della Sheet non ha margini suoi: li mette ogni pannello (come ItemFormSheet). */}
      <div className="flex flex-col gap-6 px-4 pt-2 pb-6">
        {other && (
          <SegmentedControl
            groupId="chore-mode"
            label="Segnare o suggerire"
            value={mode}
            onChange={(v) => setMode(v as AddChoreMode)}
            options={[
              { value: 'fatto', label: 'Ho fatto' },
              { value: 'suggerisci', label: `Suggerisci a ${other.label}` },
            ]}
          />
        )}

        {suggesting ? (
          <p className="px-1 text-sm text-muted">
            Compare sbiadito nella prima tacca libera di {other!.label}, che lo conferma quando l’ha fatto.
            Vale per oggi e non conta finché non è confermato.
          </p>
        ) : (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className={LABEL}>Chi</span>
            <SegmentedControl
              groupId="chore-done-by"
              label="Chi l’ha fatta"
              value={doneBy}
              onChange={setDoneBy}
              options={people.map((p) => ({ value: p.id, label: p.label }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className={LABEL}>Quando</span>
            <SegmentedControl
              groupId="chore-day"
              label="Quando"
              value={day}
              onChange={(v) => setDay(v as 'oggi' | 'ieri')}
              options={[
                { value: 'oggi', label: 'Oggi' },
                { value: 'ieri', label: 'Ieri' },
              ]}
            />
          </div>
        </div>
        )}

        {blocked && (
          <p className="rounded-2xl bg-surface-raised px-4 py-3 text-sm text-muted" role="status">
            {suggesting
              ? `La bottiglia di ${other!.label} è già piena per oggi, suggerimenti compresi.`
              : 'La bottiglia di oggi è piena. Puoi ancora segnare una faccenda di ieri.'}
          </p>
        )}

        <form onSubmit={submitTyped} className="flex items-center gap-2 rounded-3xl border border-border bg-surface-raised/60 p-2">
          <input
            data-autofocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={CHORE_NAME_MAX}
            aria-label="Cerca o scrivi una faccenda"
            placeholder="Cerca o scrivi una faccenda"
            enterKeyHint="done"
            className="min-h-12 min-w-0 flex-1 rounded-2xl bg-transparent px-3 text-base text-foreground placeholder:text-muted focus:outline-none"
          />
          <button
            type="submit"
            aria-label={suggesting ? 'Suggerisci questa faccenda' : 'Riempi una tacca con questa faccenda'}
            disabled={!typed || blocked}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform active:scale-95 disabled:opacity-50"
          >
            <Check className="size-5" aria-hidden />
          </button>
        </form>

        {typed ? (
          <div className="flex flex-col gap-4">
            {results.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {results.map((name) => (
                  <Chip key={name} variant="suggestion" disabled={blocked} onClick={() => save(name)}>
                    {name}
                  </Chip>
                ))}
              </div>
            )}

            {!exactMatch && (
              <div className="flex flex-col gap-3 rounded-2xl bg-surface-raised px-4 py-3">
                <label className="flex min-h-11 items-center gap-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={saveToGroup !== null}
                    onChange={(e) => setSaveToGroup(e.target.checked ? (group?.id ?? CHORE_PRESET_GROUPS[0].id) : null)}
                    className="size-5 accent-accent"
                  />
                  Salva «{typed}» tra le vostre azioni
                </label>
                {saveToGroup !== null && (
                  <div className="-mx-1 flex flex-wrap gap-2" role="group" aria-label="In quale ambito">
                    {CHORE_PRESET_GROUPS.map((g) => (
                      <Chip key={g.id} active={saveToGroup === g.id} onClick={() => setSaveToGroup(g.id)}>
                        {g.icon} {g.label}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <span className={LABEL}>Azioni</span>
            <div className="-mx-4 -mt-2 overflow-x-auto px-4 [scrollbar-width:none]">
              <div className="flex w-max gap-2" role="group" aria-label="Ambiti">
                <Chip active={tab === RECENT_TAB} onClick={() => selectTab(RECENT_TAB)}>
                  🕘 Recenti
                </Chip>
                {CHORE_PRESET_GROUPS.map((g) => (
                  <Chip key={g.id} active={tab === g.id} onClick={() => selectTab(g.id)}>
                    {g.icon} {g.label}
                  </Chip>
                ))}
              </div>
            </div>

            {tab === RECENT_TAB && recent.length === 0 ? (
              <p className="text-sm text-muted">Qui compaiono le ultime faccende segnate.</p>
            ) : tab === RECENT_TAB ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {recent.map((name) =>
                    editing ? (
                      <Chip
                        key={name}
                        variant="suggestion"
                        onClick={() => onDismissRecent(name)}
                        aria-label={`Togli ${name} dai recenti`}
                        className="inline-flex items-center gap-1.5 border-dashed"
                      >
                        {name}
                        <X className="size-3.5" aria-hidden />
                      </Chip>
                    ) : (
                      <Chip key={name} variant="suggestion" disabled={blocked} onClick={() => save(name)}>
                        {name}
                      </Chip>
                    ),
                  )}
                </div>
                {editing && (
                  <p className="text-xs text-muted">
                    Togliere un nome non cancella le faccende già segnate: torna tra i recenti quando la rifate.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setEditing((e) => !e)}
                  aria-pressed={editing}
                  className="inline-flex min-h-11 items-center gap-2 self-start rounded-full px-3 text-sm font-medium text-accent-soft hover:bg-surface-raised"
                >
                  <Pencil className="size-4" aria-hidden />
                  {editing ? 'Fine' : 'Togli dai recenti'}
                </button>
              </div>
            ) : (
              group && (
                <div className="flex flex-col gap-3">
                  {tabCustom.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {tabCustom.map((preset) =>
                        editing ? (
                          <Chip
                            key={preset.id}
                            variant="suggestion"
                            onClick={() => setToDelete(preset)}
                            aria-label={`Elimina l’azione ${preset.name}`}
                            className="inline-flex items-center gap-1.5 border-dashed"
                          >
                            {preset.name}
                            <X className="size-3.5" aria-hidden />
                          </Chip>
                        ) : (
                          <Chip key={preset.id} variant="suggestion" disabled={blocked} onClick={() => save(preset.name)}>
                            {preset.name}
                          </Chip>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">
                      Ancora nessuna azione in {group.icon} {group.label}. Aggiungi quelle che fate più spesso.
                    </p>
                  )}

                  <form onSubmit={createPreset} className="flex items-center gap-2">
                    <input
                      value={newPreset}
                      onChange={(e) => setNewPreset(e.target.value)}
                      maxLength={CHORE_NAME_MAX}
                      aria-label={`Nuova azione in ${group.label}`}
                      placeholder={`Nuova azione in ${group.label}`}
                      enterKeyHint="done"
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-dashed border-border-strong bg-transparent px-3 text-base text-foreground placeholder:text-muted focus:border-solid focus:border-accent focus:outline-none"
                    />
                    <button
                      type="submit"
                      aria-label="Aggiungi l’azione"
                      disabled={!newPreset.trim() || creating}
                      className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent-soft',
                        'transition-transform active:scale-95 disabled:opacity-50',
                      )}
                    >
                      {creating ? <Spinner size="sm" /> : <Plus className="size-5" aria-hidden />}
                    </button>
                  </form>

                  {tabCustom.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEditing((e) => !e)}
                      aria-pressed={editing}
                      className="inline-flex min-h-11 items-center gap-2 self-start rounded-full px-3 text-sm font-medium text-accent-soft hover:bg-surface-raised"
                    >
                      <Pencil className="size-4" aria-hidden />
                      {editing ? 'Fine' : 'Elimina azioni'}
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>

      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Eliminare «${toDelete?.name ?? ''}»?`}
        description="L’azione sparisce per tutti e due. Le faccende già segnate con questo nome restano nelle bottiglie."
        confirmLabel="Elimina"
        confirmVariant="destructive"
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </Sheet>
  )
}
