import { ExpenseRowsSkeleton } from '@/components/ExpenseRowSkeleton'
import { SpendingRingSkeleton } from '@/components/SpendingRingSkeleton'
import { Card } from '@/components/ui/Card'
import { Skeleton, SkeletonPage } from '@/components/ui/Skeleton'
import { HeaderActions } from '@/components/HeaderActions'

/**
 * Scheletro della home: stesse classi di `HomeShell` — saluto, griglia che su
 * xl si apre in due colonne (saldo a sinistra, ultime spese a destra) e lo
 * spazio in fondo per il FAB. Il FAB non viene disegnato: è fisso, non sposta
 * niente, e un cerchio che non risponde al tocco durante l'attesa fa più
 * danno che bene.
 */
export default function HomeLoading() {
  return (
    <SkeletonPage className="px-4 pt-4 pb-24 lg:pb-6" label="Caricamento della home">
      <header className="mb-4 flex items-center gap-3 px-1">
        <Skeleton className="h-9 w-56 max-w-full rounded-lg" />
        <HeaderActions className="ml-auto" />
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_1.3fr]">
        {/* Hero del saldo, senza card: l'anello centrato. */}
        <div className="relative isolate">
          <div aria-hidden className="hero-glow pointer-events-none absolute -inset-x-4 -top-24 -bottom-6 -z-10" />
          <div className="px-1 py-2">
            <SpendingRingSkeleton compact />
          </div>
          {/* Azioni rapide: quattro cerchi con l'etichetta sotto. */}
          <div className="mt-2 grid grid-cols-4 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex min-h-[4.75rem] flex-col items-center gap-1.5 pt-1">
                <Skeleton className="size-11 rounded-full" />
                <Skeleton className="h-3 w-14 rounded-md" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <section>
            <div className="mb-3 flex items-center justify-between px-1">
              <Skeleton className="h-5 w-28 rounded-md" />
              <div className="flex min-h-11 items-center">
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>
            </div>
            <Card className="overflow-hidden p-0">
              <ExpenseRowsSkeleton rows={5} />
            </Card>
          </section>
        </div>
      </div>
    </SkeletonPage>
  )
}
