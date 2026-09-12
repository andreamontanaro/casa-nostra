import { ExpenseRowsSkeleton } from '@/components/ExpenseRowSkeleton'
import { Card } from '@/components/ui/Card'
import { Skeleton, SkeletonPage } from '@/components/ui/Skeleton'

/** Un giorno dello storico: intestazione con data e totale, poi le righe. */
function DayGroupSkeleton({ rows }: { rows: number }) {
  return (
    <section>
      <div className="mb-2 flex justify-between gap-3 px-1 py-3">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-4 w-16 rounded-md" />
      </div>
      <Card className="divide-y divide-border overflow-hidden">
        <ExpenseRowsSkeleton rows={rows} />
      </Card>
    </section>
  )
}

/**
 * Scheletro dello storico: titolo della pagina, la barra "Filtri e ricerca"
 * chiusa come la trova chi arriva (i filtri veri stanno in un `details`, non
 * in una fila di chip), la riga del conteggio e i gruppi per giorno.
 */
export default function SpeseLoading() {
  return (
    <SkeletonPage
      className="flex flex-col gap-4 px-4 pt-6 pb-4"
      label="Caricamento dello storico spese"
    >
      <Skeleton className="h-9 w-52 rounded-lg" />

      <div className="space-y-3 pb-24">
        <div className="rounded-2xl border border-border bg-surface">
          <div className="flex min-h-13 items-center gap-3 px-4 py-3">
            <Skeleton className="size-4 shrink-0 rounded-md" />
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="ml-auto h-4 w-10 rounded-md" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
          <Skeleton className="h-5 w-48 rounded-md" />
        </div>

        <DayGroupSkeleton rows={3} />
        <DayGroupSkeleton rows={2} />
        <DayGroupSkeleton rows={4} />
      </div>
    </SkeletonPage>
  )
}
