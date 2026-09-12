import { Card } from '@/components/ui/Card'
import { Skeleton, SkeletonIconButton, SkeletonPage } from '@/components/ui/Skeleton'

/** Riga "voce → valore" della card di dettaglio, alta come una `ListRow`. */
function DetailRowSkeleton({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-3">
      <Skeleton className={`h-4 rounded-md ${label}`} />
      <Skeleton className={`h-4 rounded-md ${value}`} />
    </div>
  )
}

/**
 * Scheletro del dettaglio spesa, nell'ordine fisso della pagina: intestazione
 * con il ritorno allo storico, riepilogo con icona, descrizione, stato e
 * importo grande, le quattro voci del dettaglio, la divisione in due colonne
 * e il bottone di modifica in fondo.
 */
export default function SpesaDetailLoading() {
  return (
    <SkeletonPage className="flex flex-col pb-4" label="Caricamento della spesa">
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        <SkeletonIconButton />
        <Skeleton className="h-7 w-40 rounded-md" />
      </header>

      <section className="px-4 pb-5">
        <div className="flex items-start gap-4">
          <Skeleton className="size-12 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-6 w-2/3 rounded-md" />
            <Skeleton className="mt-1 h-3 w-32 rounded-md" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
        <Skeleton className="mt-4 h-9 w-48 rounded-lg" />
      </section>

      <div className="px-4 pb-5">
        <Card className="divide-y divide-border overflow-hidden p-0">
          <DetailRowSkeleton label="w-24" value="w-28" />
          <DetailRowSkeleton label="w-20" value="w-24" />
          <DetailRowSkeleton label="w-20" value="w-16" />
          <DetailRowSkeleton label="w-16" value="w-20" />
        </Card>
      </div>

      <section className="px-4 pb-4">
        <Skeleton className="mb-3 h-5 w-40 rounded-md" />
        <Card className="grid grid-cols-2 gap-4 p-5">
          {['w-20', 'w-24'].map((width) => (
            <div key={width}>
              <Skeleton className={`h-4 rounded-md ${width}`} />
              <Skeleton className="mt-2 h-6 w-24 rounded-md" />
            </div>
          ))}
        </Card>
      </section>

      <div className="px-4 py-5">
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </SkeletonPage>
  )
}
