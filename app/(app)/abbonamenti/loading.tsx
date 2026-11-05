import { Card } from '@/components/ui/Card'
import { Skeleton, SkeletonPage } from '@/components/ui/Skeleton'
import { HeaderActions } from '@/components/HeaderActions'

/**
 * Scheletro degli abbonamenti: introduzione, totale mensile, ora degli
 * avvisi, l'elenco e il bottone in fondo, con le stesse misure della pagina.
 */
export default function AbbonamentiLoading() {
  return (
    <SkeletonPage
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-24 lg:pb-8"
      label="Caricamento degli abbonamenti"
    >
      <header className="flex items-center gap-3">
        <Skeleton className="h-9 w-44 rounded-lg" />
        <HeaderActions className="ml-auto" />
      </header>

      <div className="-mt-2 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-full rounded-md" />
        <Skeleton className="h-3.5 w-4/5 rounded-md" />
      </div>

      <Card className="flex items-end justify-between gap-3 p-5">
        <div>
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="mt-2 h-8 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-4 w-14 rounded-md" />
      </Card>

      <Card className="flex items-center gap-3 p-4">
        <Skeleton className="size-10 shrink-0 rounded-2xl" />
        <Skeleton className="h-4 flex-1 rounded-md" />
        <Skeleton className="h-11 w-20 rounded-2xl" />
      </Card>

      <Card className="overflow-hidden py-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <Skeleton className="size-10 shrink-0 rounded-2xl" />
            <div className="flex-1">
              <Skeleton className="h-4 w-1/2 rounded-md" />
              <Skeleton className="mt-2 h-3 w-3/4 rounded-md" />
            </div>
            <div className="flex flex-col items-end">
              <Skeleton className="h-4 w-14 rounded-md" />
              <Skeleton className="mt-2 h-3 w-10 rounded-md" />
            </div>
          </div>
        ))}
      </Card>

      <Skeleton className="h-12 w-full rounded-full sm:w-52 sm:self-end" />
    </SkeletonPage>
  )
}
