'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Sheet } from '@/components/ui/Sheet'
import { CHORE_NAME_MAX } from '@/lib/chores/bottle'

export interface AddChoreValues {
  name: string
  doneBy: string
  day: 'oggi' | 'ieri'
}

interface Person {
  id: string
  label: string
  /** La bottiglia di oggi è piena: si può ancora segnare per ieri. */
  fullToday: boolean
}

interface AddChoreSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  people: Person[]
  initialDoneBy: string
  suggestions: string[]
  onSubmit: (values: AddChoreValues) => void
}

/**
 * "Ho fatto una faccenda": nome, chi e quando. Chi e quando hanno già il
 * valore giusto (io, oggi); si cambiano solo per segnare per l'altro o per
 * ricordarsi di ieri. Il form si rimonta a ogni apertura (key del chiamante),
 * quindi lo stato parte sempre pulito.
 */
export function AddChoreSheet({
  open,
  onOpenChange,
  people,
  initialDoneBy,
  suggestions,
  onSubmit,
}: AddChoreSheetProps) {
  const [name, setName] = useState('')
  const [doneBy, setDoneBy] = useState(initialDoneBy)
  const [day, setDay] = useState<'oggi' | 'ieri'>('oggi')

  const person = people.find((p) => p.id === doneBy)
  const blocked = day === 'oggi' && !!person?.fullToday
  const trimmed = name.trim()
  const canSubmit = trimmed.length > 0 && trimmed.length <= CHORE_NAME_MAX && !blocked

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit({ name: trimmed, doneBy, day })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Ho fatto una faccenda"
      footer={
        <Button type="submit" form="add-chore-form" size="lg" className="w-full" disabled={!canSubmit}>
          Riempi una tacca
        </Button>
      }
    >
      <form id="add-chore-form" onSubmit={submit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Cosa</span>
          <input
            data-autofocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={CHORE_NAME_MAX}
            placeholder="Es. Lavo i piatti"
            enterKeyHint="done"
            className="min-h-12 rounded-2xl border border-border bg-surface px-4 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>

        {suggestions.length > 0 && (
          <div className="-mx-1 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Chip key={s} variant="suggestion" onClick={() => setName(s)}>
                {s}
              </Chip>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Chi</span>
          <SegmentedControl
            groupId="chore-done-by"
            label="Chi l’ha fatta"
            value={doneBy}
            onChange={setDoneBy}
            options={people.map((p) => ({ value: p.id, label: p.label }))}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Quando</span>
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

        {blocked && (
          <p className="text-sm text-muted" role="status">
            La bottiglia di oggi è piena. Puoi ancora segnare una faccenda di ieri.
          </p>
        )}
      </form>
    </Sheet>
  )
}
