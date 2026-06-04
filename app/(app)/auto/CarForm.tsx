'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { ImagePlus, X, Car as CarIcon } from 'lucide-react'
import {
  createCar,
  updateCar,
  deleteCar,
  type CarFormState,
} from '@/app/actions/cars'
import { uploadCarPhoto, validateCarPhoto } from '@/lib/car-photos'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/lib/toast'
import { FUEL_LABELS, FUEL_ICON } from '@/lib/fmt'
import { Constants, type Tables } from '@/types/database'
import { cn } from '@/lib/utils'

type Car = Tables<'cars'>
type FuelTypeValue = (typeof Constants.public.Enums.fuel_type)[number]

interface CarFormProps {
  currentUserId: string
  car?: Car
  photoUrl?: string | null
}

export function CarForm({ currentUserId, car, photoUrl }: CarFormProps) {
  const router = useRouter()
  const isEdit = Boolean(car)

  const boundAction = isEdit ? updateCar.bind(null, car!.id) : createCar
  const [state, action, pending] = useActionState<CarFormState, FormData>(
    boundAction,
    {},
  )

  const [fuelType, setFuelType] = useState<FuelTypeValue>(
    car?.fuel_type ?? 'benzina',
  )
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const finalizing = Boolean(state.ok && state.carId)

  useEffect(() => {
    if (!photoFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(photoFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  // Dopo il salvataggio: carica l'eventuale foto e naviga.
  useEffect(() => {
    if (!state.ok || !state.carId) return
    let cancelled = false
    ;(async () => {
      if (photoFile) {
        const res = await uploadCarPhoto(
          state.carId!,
          currentUserId,
          photoFile,
          car?.photo_path ?? null,
        )
        if (!res.ok) toast.error('Auto salvata, ma la foto non è stata caricata.')
      }
      if (cancelled) return
      if (isEdit) {
        router.push(`/auto/${state.carId}?ok=car-updated`)
      } else {
        router.push('/auto?ok=car-created')
      }
      router.refresh()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.carId])

  function handlePickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const err = validateCarPhoto(file)
    if (err) {
      toast.error(err)
      return
    }
    setPhotoFile(file)
  }

  async function handleDelete() {
    if (!car) return
    setDeleting(true)
    try {
      await deleteCar(car.id)
    } catch (e) {
      if (isRedirectError(e)) throw e
      toast.error("Errore durante l'eliminazione.")
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const shownPhoto = previewUrl ?? (photoFile ? null : photoUrl ?? null)
  const busy = pending || finalizing

  return (
    <>
      <form action={action} className="flex flex-col gap-5 px-4 pt-2 pb-6">
        {/* Foto */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Foto</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handlePickPhoto}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className={cn(
              'relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-3xl border border-dashed border-border bg-surface-raised',
              'transition-[border-color] duration-150 hover:border-accent/50 disabled:opacity-50',
            )}
          >
            {shownPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownPhoto} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1.5 text-muted">
                <ImagePlus className="size-7" />
                <span className="text-sm font-medium">Aggiungi una foto</span>
              </span>
            )}
          </button>
          {photoFile && (
            <button
              type="button"
              onClick={() => setPhotoFile(null)}
              disabled={busy}
              className="self-start text-xs font-medium text-muted hover:text-destructive"
            >
              <X className="mr-1 inline size-3" />
              Rimuovi foto selezionata
            </button>
          )}
          <p className="text-xs text-muted">JPG o PNG · max 10 MB</p>
        </div>

        <Input
          label="Modello"
          name="model"
          placeholder="es. Volkswagen Golf"
          defaultValue={car?.model ?? ''}
          required
          disabled={busy}
          error={state.fieldErrors?.model}
        />

        {/* Carburante */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Carburante</span>
          <div className="grid grid-cols-3 gap-2">
            {Constants.public.Enums.fuel_type.map((ft) => {
              const isActive = fuelType === ft
              return (
                <button
                  key={ft}
                  type="button"
                  onClick={() => setFuelType(ft)}
                  disabled={busy}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5',
                    'text-sm font-medium transition-[border-color,background-color,color,transform] duration-150',
                    'active:scale-[0.97]',
                    isActive
                      ? 'border-accent bg-accent-muted text-accent shadow-soft'
                      : 'border-border bg-surface text-muted hover:border-accent/40',
                  )}
                >
                  <span className="text-base leading-none">{FUEL_ICON[ft]}</span>
                  <span className="truncate">{FUEL_LABELS[ft]}</span>
                </button>
              )
            })}
          </div>
          <input type="hidden" name="fuel_type" value={fuelType} />
          {state.fieldErrors?.fuel_type && (
            <p className="text-xs text-destructive">{state.fieldErrors.fuel_type}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Anno"
            name="year"
            type="number"
            inputMode="numeric"
            placeholder="es. 2019"
            defaultValue={car?.year != null ? String(car.year) : ''}
            disabled={busy}
            error={state.fieldErrors?.year}
          />
          <Input
            label="Serbatoio (L)"
            name="tank_capacity"
            type="text"
            inputMode="decimal"
            placeholder="es. 50"
            defaultValue={
              car?.tank_capacity != null ? String(car.tank_capacity) : ''
            }
            disabled={busy}
            error={state.fieldErrors?.tank_capacity}
          />
        </div>

        <Input
          label="Chilometraggio iniziale"
          name="initial_km"
          type="number"
          inputMode="numeric"
          placeholder="es. 45000"
          defaultValue={car?.initial_km != null ? String(car.initial_km) : '0'}
          disabled={busy}
          error={state.fieldErrors?.initial_km}
        />

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        <div className="mt-1 flex flex-col gap-3">
          <Button type="submit" size="lg" loading={busy} className="w-full">
            {isEdit ? 'Salva modifiche' : 'Aggiungi auto'}
          </Button>
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="w-full"
              onClick={() => setDeleteOpen(true)}
              disabled={busy}
            >
              Elimina auto
            </Button>
          )}
        </div>
      </form>

      {finalizing && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
          <span className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm text-muted shadow-card">
            <Spinner size="sm" /> Salvataggio…
          </span>
        </div>
      )}

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Elimina auto"
        description="Verranno eliminati anche tutti i rifornimenti e le letture del contachilometri collegati. L'operazione non può essere annullata."
        confirmLabel="Elimina"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      >
        <div className="flex items-center gap-3 rounded-2xl bg-surface-raised px-3 py-2.5">
          <CarIcon className="size-5 text-muted" />
          <span className="text-sm font-medium text-foreground">
            {car?.model}
          </span>
        </div>
      </Dialog>
    </>
  )
}
