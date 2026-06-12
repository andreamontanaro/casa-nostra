'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { Gauge, Plus, Trash2 } from 'lucide-react'
import {
  createOdometerReading,
  deleteOdometerReading,
} from '@/app/actions/cars'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { toast } from '@/lib/toast'
import { formatDate, formatKm, todayISO } from '@/lib/fmt'
import type { Tables } from '@/types/database'

type OdometerReading = Tables<'odometer_readings'>

interface OdometerSectionProps {
  carId: string
  currentKm: number
  readings: OdometerReading[]
}

export function OdometerSection({
  carId,
  currentKm,
  readings,
}: OdometerSectionProps) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [km, setKm] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [pending, startTransition] = useTransition()

  const [deleteTarget, setDeleteTarget] = useState<OdometerReading | null>(null)
  const [deleting, setDeleting] = useState(false)

  function submit() {
    setError(undefined)
    const fd = new FormData()
    fd.set('car_id', carId)
    fd.set('reading_date', date)
    fd.set('km', km)
    startTransition(async () => {
      const res = await createOdometerReading({}, fd)
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.fieldErrors) {
        setError(res.fieldErrors.km ?? res.fieldErrors.reading_date ?? 'Dati non validi.')
        return
      }
      toast.success('Chilometraggio aggiornato.')
      setAddOpen(false)
      setKm('')
      setDate(todayISO())
      router.refresh()
    })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteOdometerReading(deleteTarget.id, carId)
      toast.success('Lettura eliminata.')
      setDeleteTarget(null)
      router.refresh()
    } catch (e) {
      if (isRedirectError(e)) throw e
      toast.error("Errore durante l'eliminazione.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="size-4 text-muted" />
          <p className="text-sm font-semibold text-foreground">Chilometraggio</p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatKm(currentKm)}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-4" />
          Aggiorna km
        </Button>

        {readings.length > 0 && (
          <ul className="divide-y divide-border">
            {readings.slice(0, 5).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 py-2 first:pt-0"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {formatKm(r.km)}
                  </span>
                  <span className="text-xs text-muted">
                    {formatDate(r.reading_date)}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Elimina lettura"
                  onClick={() => setDeleteTarget(r)}
                  className="-my-1.5 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-raised hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Aggiorna chilometraggio"
        description="Registra la lettura del contachilometri, anche senza un rifornimento."
        confirmLabel="Salva"
        onConfirm={submit}
        loading={pending}
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Km attuali"
            type="number"
            inputMode="numeric"
            placeholder="es. 48200"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            error={error}
          />
          <Input
            label="Data"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Elimina lettura"
        description="Vuoi eliminare questa lettura del contachilometri?"
        confirmLabel="Elimina"
        confirmVariant="destructive"
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </Card>
  )
}
