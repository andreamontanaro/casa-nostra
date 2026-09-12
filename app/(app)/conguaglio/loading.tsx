import { SpendingRingSkeleton } from '@/components/SpendingRingSkeleton'
import { Card } from '@/components/ui/Card'
import { Skeleton, SkeletonPage } from '@/components/ui/Skeleton'

/** Riga di una spesa da includere: checkbox, icona, importo e contributo. */
function SelectableExpenseSkeleton({ titleClassName }: { titleClassName: string }) {
  return (
    <div className="flex items-start gap-2 py-4 pr-4 pl-1">
      <div className="flex size-11 shrink-0 items-center justify-center">
        <Skeleton className="size-[22px] rounded-md" />
      </div>
      <div className="pt-1">
        <Skeleton className="size-10 shrink-0 rounded-2xl" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-x-3">
          <Skeleton className={`h-4 rounded-md ${titleClassName}`} />
          <Skeleton className="h-4 w-16 shrink-0 rounded-md" />
        </div>
        <Skeleton className="mt-2 h-3 w-2/3 rounded-md" />
        <Skeleton className="mt-2.5 h-3 w-1/2 rounded-md" />
      </div>
    </div>
  )
}

/**
 * Scheletro del conguaglio: anello grande con la legenda a sinistra, elenco
 * delle spese da includere a destra (due colonne da xl in su) e la barra
 * sticky in fondo, ferma sopra la bottom navigation come quella vera — così
 * il bottone "Registra bonifico" non salta quando i dati arrivano.
 */
export default function ConguaglioLoading() {
  return (
    <SkeletonPage className="flex flex-col gap-5 px-4 pt-6" label="Caricamento del conguaglio">
      <header className="px-1">
        <Skeleton className="mb-1 h-5 w-60 rounded-md" />
        <Skeleton className="h-9 w-52 rounded-lg" />
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.15fr]">
        <Card className="p-5">
          <SpendingRingSkeleton />
          <div className="mt-4 flex flex-col gap-2">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-3/4 rounded-md" />
          </div>
          <div className="mt-3 flex min-h-11 items-center justify-center">
            <Skeleton className="h-4 w-60 rounded-md" />
          </div>
        </Card>

        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <Skeleton className="h-5 w-44 rounded-md" />
            <div className="flex min-h-11 items-center px-3">
              <Skeleton className="h-4 w-32 rounded-md" />
            </div>
          </div>
          <div className="mb-4 px-1">
            <Skeleton className="h-5 w-11/12 rounded-md" />
          </div>
          <Card className="divide-y divide-border overflow-hidden">
            {['w-1/2', 'w-2/3', 'w-5/12', 'w-7/12'].map((width) => (
              <SelectableExpenseSkeleton key={width} titleClassName={width} />
            ))}
          </Card>
        </section>
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-md lg:bottom-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton className="mt-2 h-4 w-52 rounded-md" />
          </div>
          <Skeleton className="h-13 w-64 rounded-full" />
        </div>
      </div>
    </SkeletonPage>
  )
}
