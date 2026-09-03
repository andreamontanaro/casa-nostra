'use client'

import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Input } from '@/components/ui/Input'
import { Chip } from '@/components/ui/Chip'
import { Button } from '@/components/ui/Button'
import {
  createChoreTemplate,
  updateChoreTemplate,
  setChoreTemplateActive,
  deleteChoreTemplate,
} from '@/app/actions/chores'
import { toast } from '@/lib/toast'
import { CHORE_AREA_LABELS } from '@/lib/fmt'
import { Constants } from '@/types/database'
import type { ChoreTemplate } from '@/lib/queries'

type ChoreArea = (typeof Constants.public.Enums.chore_area)[number]

const AREAS = Constants.public.Enums.chore_area

interface TemplateFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Assente = creazione; presente = modifica di una voce esistente. */
  template?: ChoreTemplate | null
}

/**
 * Sheet di creazione/modifica di una voce del catalogo. Il seed iniziale
 * (docs/design-modulo-gestione-casa.md) è solo il contenuto di partenza della
 * tabella: qui i due utenti possono ritararlo per intero, in ogni momento.
 */
// Stato inizializzato una sola volta dal `template` con cui il componente è
// montato: niente useEffect di sincronizzazione. Chi usa questo componente
// lo rimonta (prop `key`) quando cambia la voce da modificare o quando la
// sheet di creazione si riapre, cosa che già succede in CatalogoClient.
export function TemplateFormSheet({ open, onOpenChange, template }: TemplateFormSheetProps) {
  const isEdit = Boolean(template)
  const [name, setName] = useState(template?.name ?? '')
  const [area, setArea] = useState<ChoreArea>(template?.area ?? 'altro')
  const [xp, setXp] = useState(template ? String(template.effort_xp) : '10')
  const [isGesto, setIsGesto] = useState(template ? template.cadence_days === null : false)
  const [cadenceDays, setCadenceDays] = useState(
    template?.cadence_days ? String(template.cadence_days) : '7',
  )
  const [pending, setPending] = useState(false)

  async function handleSave() {
    const parsedXp = parseInt(xp, 10)
    const parsedCadence = isGesto ? null : parseInt(cadenceDays, 10)

    setPending(true)
    const result = template
      ? await updateChoreTemplate(template.id, { name, area, effortXp: parsedXp, cadenceDays: parsedCadence })
      : await createChoreTemplate({ name, area, effortXp: parsedXp, cadenceDays: parsedCadence })
    setPending(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(isEdit ? 'Faccenda aggiornata.' : 'Faccenda aggiunta al catalogo.')
    onOpenChange(false)
  }

  async function handleToggleActive() {
    if (!template) return
    setPending(true)
    const result = await setChoreTemplateActive(template.id, !template.active)
    setPending(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(template.active ? 'Faccenda disattivata.' : 'Faccenda riattivata.')
    onOpenChange(false)
  }

  async function handleDelete() {
    if (!template) return
    setPending(true)
    const result = await deleteChoreTemplate(template.id)
    setPending(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Faccenda eliminata.')
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Modifica faccenda' : 'Nuova faccenda'}
      size="auto"
      footer={
        <div className="flex gap-2">
          {isEdit && (
            <Button variant="outline" onClick={handleToggleActive} disabled={pending}>
              {template!.active ? 'Disattiva' : 'Riattiva'}
            </Button>
          )}
          <Button className="flex-1" onClick={handleSave} loading={pending}>
            Salva
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-4 pb-4">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Area</span>
          <div className="flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <Chip key={a} variant="filter" active={area === a} onClick={() => setArea(a)}>
                {CHORE_AREA_LABELS[a]}
              </Chip>
            ))}
          </div>
        </div>

        <Input
          label="XP (sforzo, tarato sui minuti)"
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          value={xp}
          onChange={(e) => setXp(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Cadenza</span>
          <div className="flex items-center gap-2">
            <Chip variant="filter" active={!isGesto} onClick={() => setIsGesto(false)}>
              Ricorrente
            </Chip>
            <Chip variant="filter" active={isGesto} onClick={() => setIsGesto(true)}>
              Gesto
            </Chip>
          </div>
          {!isGesto ? (
            <Input
              label="Ogni quanti giorni"
              type="number"
              inputMode="numeric"
              min={1}
              value={cadenceDays}
              onChange={(e) => setCadenceDays(e.target.value)}
              className="mt-1"
            />
          ) : (
            <p className="mt-1 text-xs text-muted">
              Registrabile quando capita, non compare in &quot;Da fare&quot; e non ha una cadenza attesa.
            </p>
          )}
        </div>

        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="self-start text-xs text-muted underline decoration-dotted hover:text-destructive"
          >
            Elimina definitivamente (solo se non ha storico)
          </button>
        )}
      </div>
    </Sheet>
  )
}
