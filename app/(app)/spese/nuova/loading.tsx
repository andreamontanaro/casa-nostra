import {
  Skeleton,
  SkeletonChip,
  SkeletonField,
  SkeletonIconButton,
  SkeletonPage,
  SkeletonSegmented,
} from '@/components/ui/Skeleton'

/** Etichetta `text-label` sopra un gruppo di controlli. */
function FieldLabel({ className }: { className: string }) {
  return <Skeleton className={`h-4 rounded-md ${className}`} />
}

/**
 * Scheletro di "Nuova spesa": l'ordine dei campi è quello fisso di
 * `ExpenseFormFields` — importo protagonista, descrizione con i suggerimenti,
 * la griglia 3×3 delle nove categorie, divisione, pagante, data, allegati — e
 * il bottone di salvataggio in fondo. Nessun campo cambia posizione quando la
 * form vera prende il posto dello scheletro.
 */
export default function NuovaSpesaLoading() {
  return (
    <SkeletonPage
      className="mx-auto flex w-full max-w-2xl flex-col"
      label="Caricamento della nuova spesa"
    >
      <header className="flex items-center gap-3 px-4 pb-2 pt-6">
        <SkeletonIconButton />
        <Skeleton className="h-9 w-44 rounded-lg" />
      </header>

      <div className="flex flex-col gap-5 px-4 pt-4 pb-6">
        {/* Importo: campo hero da 5rem. */}
        <Skeleton className="h-20 w-full rounded-2xl" />

        <div className="flex flex-col gap-2">
          <SkeletonField labelClassName="w-24" />
          <div className="-mx-4 overflow-hidden">
            <div className="flex gap-2 px-4">
              {['w-20', 'w-28', 'w-24', 'w-20'].map((width) => (
                <SkeletonChip key={width} className={width} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel className="w-20" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface px-1 py-2.5"
              >
                <Skeleton className="size-8 rounded-xl" />
                <Skeleton className="h-4 w-14 rounded-md" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel className="w-20" />
          <SkeletonSegmented segments={3} activeIndex={1} />
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel className="w-24" />
          <div className="flex gap-2">
            {['w-10', 'w-20'].map((width) => (
              <div
                key={width}
                className="flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-border bg-surface"
              >
                <Skeleton className={`h-4 rounded-md ${width}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel className="w-12" />
          <div className="flex gap-2">
            <SkeletonChip className="w-10" />
            <SkeletonChip className="w-8" />
            <SkeletonChip className="w-20" />
          </div>
        </div>

        {/* Allegati: `details` chiuso. */}
        <div className="rounded-2xl border border-border p-4">
          <div className="flex min-h-11 items-center">
            <Skeleton className="h-4 w-64 rounded-md" />
          </div>
        </div>

        <Skeleton className="mt-5 h-13 w-full rounded-full" />
      </div>
    </SkeletonPage>
  )
}
