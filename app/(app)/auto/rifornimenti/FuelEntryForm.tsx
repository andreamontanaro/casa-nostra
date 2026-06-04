'use client'

import { useActionState, useRef, useState } from 'react'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import {
  createFuelEntry,
  updateFuelEntry,
  deleteFuelEntry,
  type FuelFormState,
} from '@/app/actions/cars'
import { deriveFuelValue, type FuelField } from '@/lib/cars'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { toast } from '@/lib/toast'
import { todayISO } from '@/lib/fmt'
import type { Tables } from '@/types/database'
import { cn } from '@/lib/utils'

type FuelEntry = Tables<'fuel_entries'>
type CarLite = Pick<Tables<'cars'>, 'id' | 'model'>

interface FuelEntryFormProps {
  cars: CarLite[]
  entry?: FuelEntry
  defaultCarId?: string
}

function parse(raw: string): number {
  return parseFloat(raw.replace(',', '.'))
}

function fmt(n: number, decimals: number): string {
  return n.toFixed(decimals).replace('.', ',')
}

export function FuelEntryForm({ cars, entry, defaultCarId }: FuelEntryFormProps) {
  const isEdit = Boolean(entry)
  const boundAction = isEdit ? updateFuelEntry.bind(null, entry!.id) : createFuelEntry
  const [state, action, pending] = useActionState<FuelFormState, FormData>(
    boundAction,
    {},
  )

  const [carId, setCarId] = useState(
    entry?.car_id ?? defaultCarId ?? cars[0]?.id ?? '',
  )
  const [fullTank, setFullTank] = useState(entry?.full_tank ?? true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!entry) return
    setDeleting(true)
    try {
      await deleteFuelEntry(entry.id)
    } catch (e) {
      if (isRedirectError(e)) throw e
      toast.error("Errore durante l'eliminazione.")
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const [liters, setLiters] = useState(
    entry ? fmt(entry.liters, 2) : '',
  )
  const [price, setPrice] = useState(
    entry ? fmt(entry.price_per_liter, 3) : '',
  )
  const [total, setTotal] = useState(
    entry ? fmt(entry.total_cost, 2) : '',
  )

  // I due campi modificati più di recente; il terzo è quello derivato.
  const recentRef = useRef<FuelField[]>(['liters', 'price'])

  function handleValueChange(field: FuelField, raw: string) {
    const next = { liters, price, total, [field]: raw }
    const recent = [field, ...recentRef.current.filter((f) => f !== field)].slice(
      0,
      2,
    )
    recentRef.current = recent

    const derived = (['liters', 'price', 'total'] as FuelField[]).find(
      (f) => !recent.includes(f),
    )!
    const d = deriveFuelValue(
      derived,
      parse(next.liters),
      parse(next.price),
      parse(next.total),
    )
    if (d != null) next[derived] = fmt(d, derived === 'price' ? 3 : 2)

    setLiters(next.liters)
    setPrice(next.price)
    setTotal(next.total)
  }

  const fieldClass = (error?: string) =>
    cn(
      'h-12 w-full rounded-2xl border bg-surface px-4',
      'text-xl font-semibold text-foreground tabular-nums shadow-soft',
      'placeholder:text-muted/60 placeholder:font-medium',
      'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
      'disabled:opacity-50',
      error ? 'border-destructive focus:ring-destructive' : 'border-border',
    )

  return (
    <>
    <form action={action} className="flex flex-col gap-5 px-4 pt-2 pb-6">
      {/* Auto */}
      {cars.length > 1 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Auto</span>
          <div className="-mx-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 px-4">
              {cars.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCarId(c.id)}
                  disabled={pending}
                  className={cn(
                    'shrink-0 rounded-2xl border px-4 py-2.5 text-sm font-medium',
                    'transition-[border-color,background-color,color,transform] duration-150 active:scale-[0.97]',
                    carId === c.id
                      ? 'border-accent bg-accent-muted text-accent shadow-soft'
                      : 'border-border bg-surface text-muted hover:border-accent/40',
                  )}
                >
                  {c.model}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <input type="hidden" name="car_id" value={carId} />
      {state.fieldErrors?.car_id && (
        <p className="text-xs text-destructive">{state.fieldErrors.car_id}</p>
      )}

      {/* Tre valori */}
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface-raised p-4">
        <p className="text-xs text-muted">
          Inserisci due valori qualsiasi: il terzo viene calcolato in automatico.
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Litri</label>
          <input
            name="liters"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            required
            disabled={pending}
            value={liters}
            onChange={(e) => handleValueChange('liters', e.target.value)}
            className={fieldClass(state.fieldErrors?.liters)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            Prezzo al litro (€)
          </label>
          <input
            name="price_per_liter"
            type="text"
            inputMode="decimal"
            placeholder="0,000"
            required
            disabled={pending}
            value={price}
            onChange={(e) => handleValueChange('price', e.target.value)}
            className={fieldClass(state.fieldErrors?.price_per_liter)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            Totale speso (€)
          </label>
          <input
            name="total_cost"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            required
            disabled={pending}
            value={total}
            onChange={(e) => handleValueChange('total', e.target.value)}
            className={fieldClass(state.fieldErrors?.total_cost)}
          />
        </div>
      </div>

      {/* Pieno / parziale */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Rifornimento</span>
        <div className="flex gap-2">
          {[
            { value: true, label: 'Pieno' },
            { value: false, label: 'Parziale' },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setFullTank(opt.value)}
              disabled={pending}
              className={cn(
                'flex-1 rounded-2xl border py-2.5 text-sm font-medium transition-[border-color,background-color,color,transform] duration-150',
                'active:scale-[0.97]',
                fullTank === opt.value
                  ? 'border-accent bg-accent-muted text-accent shadow-soft'
                  : 'border-border bg-surface text-muted hover:border-accent/40',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="full_tank" value={fullTank ? '1' : '0'} />
        <p className="text-xs text-muted">
          Il calcolo dei consumi usa i rifornimenti &quot;a pieno&quot;.
        </p>
      </div>

      {/* Data + km */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Data"
          name="entry_date"
          type="date"
          defaultValue={entry?.entry_date ?? todayISO()}
          required
          disabled={pending}
          error={state.fieldErrors?.entry_date}
        />
        <Input
          label="Km attuali"
          name="odometer_km"
          type="number"
          inputMode="numeric"
          placeholder="facoltativo"
          defaultValue={entry?.odometer_km != null ? String(entry.odometer_km) : ''}
          disabled={pending}
          error={state.fieldErrors?.odometer_km}
        />
      </div>

      <Input
        label="Note (facoltative)"
        name="notes"
        placeholder="es. distributore in autostrada"
        defaultValue={entry?.notes ?? ''}
        disabled={pending}
      />

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="mt-1 flex flex-col gap-3">
        <Button type="submit" size="lg" loading={pending} className="w-full">
          {isEdit ? 'Salva modifiche' : 'Salva rifornimento'}
        </Button>
        {isEdit && (
          <Button
            type="button"
            variant="destructive"
            size="lg"
            className="w-full"
            onClick={() => setDeleteOpen(true)}
            disabled={pending}
          >
            Elimina rifornimento
          </Button>
        )}
      </div>
    </form>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Elimina rifornimento"
        description="Sei sicuro di voler eliminare questo rifornimento? L'operazione non può essere annullata."
        confirmLabel="Elimina"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  )
}
