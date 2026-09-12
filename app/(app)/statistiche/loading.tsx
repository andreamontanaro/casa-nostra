import { Card } from '@/components/ui/Card'
import { Skeleton, SkeletonPage, SkeletonSegmented } from '@/components/ui/Skeleton'

// Altezze fisse (in percentuale dei 176px del grafico): un istogramma di
// barre tutte uguali non si legge come un grafico, e valori casuali
// cambierebbero tra server e client.
const BAR_HEIGHTS = [38, 52, 44, 67, 58, 81, 49, 72, 61, 90, 55, 43]

export default function StatisticheLoading() {
  return (
    <SkeletonPage className="space-y-5 px-4 pb-8 pt-6" label="Caricamento delle statistiche">
      <Skeleton className="h-9 w-44 rounded-lg" />

      <SkeletonSegmented segments={4} activeIndex={1} />

      {/* Spese totali del periodo */}
      <Card className="p-5">
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="mt-2 h-3 w-44 rounded-md" />
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-7 w-14 rounded-full" />
        </div>
        <Skeleton className="mt-3 h-3 w-3/4 rounded-md" />
        <div className="mt-3 flex min-h-11 items-center">
          <Skeleton className="h-4 w-48 rounded-md" />
        </div>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {/* Ultimi 12 mesi: il grafico tiene la sua altezza di 11rem. */}
        <Card className="min-w-0 p-5">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="mt-2 h-3 w-52 rounded-md" />
          <div className="mt-4 flex h-44 items-end gap-1">
            {BAR_HEIGHTS.map((height, i) => (
              <div key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
                <Skeleton
                  className="mx-auto w-3/4 rounded-t-md"
                  // 140px è l'altezza massima delle colonne vere dentro le 11rem.
                  style={{ height: `${(height / 100) * 140}px` }}
                />
                <Skeleton className="mx-auto h-3 w-2/3 rounded-sm" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex min-h-12 items-center border-t border-border">
            <Skeleton className="h-4 w-56 rounded-md" />
          </div>
        </Card>

        {/* Per categoria */}
        <Card className="min-w-0 p-5">
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="mt-2 h-3 w-44 rounded-md" />
          <div className="mt-4 flex flex-col gap-2">
            {['w-24', 'w-32', 'w-20', 'w-28', 'w-24'].map((width) => (
              <div key={width} className="p-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-8 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className={`h-4 rounded-md ${width}`} />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Skeleton className="h-4 w-16 rounded-md" />
                    <Skeleton className="h-3 w-20 rounded-md" />
                  </div>
                </div>
                <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Conguagli registrati */}
      <Card className="p-5">
        <Skeleton className="h-5 w-48 rounded-md" />
        <Skeleton className="mt-2 h-3 w-44 rounded-md" />
        <div className="mt-4 grid gap-3 rounded-2xl bg-surface-raised p-4 sm:grid-cols-3">
          {['w-16', 'w-24', 'w-28'].map((width) => (
            <div key={width} className="flex items-center justify-between gap-3 sm:block">
              <Skeleton className={`h-3 rounded-md ${width}`} />
              <Skeleton className="h-7 w-20 rounded-md sm:mt-1" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col divide-y divide-border">
          {['w-40', 'w-48', 'w-36'].map((width) => (
            <div key={width} className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <Skeleton className={`h-4 rounded-md ${width}`} />
                <Skeleton className="mt-2 h-3 w-32 rounded-md" />
              </div>
              <Skeleton className="h-4 w-16 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </Card>
    </SkeletonPage>
  )
}
