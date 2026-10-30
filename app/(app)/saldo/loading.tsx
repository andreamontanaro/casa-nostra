import { SpendingRingSkeleton } from '@/components/SpendingRingSkeleton'
import { Card } from '@/components/ui/Card'
import { Skeleton, SkeletonPage } from '@/components/ui/Skeleton'
import { HeaderActions } from '@/components/HeaderActions'

/**
 * Scheletro dei dettagli del saldo: anello grande a sinistra, le due persone
 * e le categorie a destra (due colonne da xl in su), come `BalanceDetails`.
 */
export default function SaldoLoading() {
  return (
    <SkeletonPage className="flex flex-col gap-5 px-4 pt-6 pb-24 lg:pb-6" label="Caricamento dei dettagli del saldo">
      <header className="flex items-start gap-3 px-1">
        <div className="min-w-0 flex-1">
          <Skeleton className="mb-1 h-5 w-52 max-w-full rounded-md" />
          <Skeleton className="h-9 w-60 max-w-full rounded-lg" />
        </div>
        <HeaderActions />
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_1.15fr]">
        <Card className="p-5">
          <SpendingRingSkeleton />
          <Skeleton className="mx-auto mt-4 h-3 w-24 rounded-md" />
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <section>
            <Skeleton className="mb-3 ml-1 h-5 w-36 rounded-md" />
            <Card className="divide-y divide-border overflow-hidden">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="flex-1"><Skeleton className="h-4 w-20 rounded-md" /><Skeleton className="mt-2 h-3 w-24 rounded-md" /></div>
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
              ))}
            </Card>
          </section>
          <section>
            <Skeleton className="mb-3 ml-1 h-5 w-28 rounded-md" />
            <Card className="divide-y divide-border overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex justify-between"><Skeleton className="h-4 w-24 rounded-md" /><Skeleton className="h-4 w-16 rounded-md" /></div>
                  <Skeleton className="mt-2 h-3 w-40 rounded-md" />
                  <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
                </div>
              ))}
            </Card>
          </section>
        </div>
      </div>
    </SkeletonPage>
  )
}
