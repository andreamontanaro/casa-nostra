import { Skeleton, SkeletonListRow } from '@/components/ui/Skeleton'

// Larghezze diverse riga per riga: una lista di barre tutte uguali si legge
// come una tabella vuota, non come spese in arrivo.
const TITLE_WIDTHS = ['w-2/3', 'w-1/2', 'w-3/4', 'w-5/12', 'w-7/12']

/**
 * Segnaposto di `ExpenseRow`. Ricalca la geometria della riga vera — icona
 * categoria da 40px, descrizione e sottotitolo, colonna a destra con importo,
 * data e stato — così la card non cambia altezza quando arrivano le spese.
 */
export function ExpenseRowSkeleton({ index = 0 }: { index?: number }) {
  return (
    <SkeletonListRow
      leading={<Skeleton className="size-10 shrink-0 rounded-2xl" />}
      titleClassName={TITLE_WIDTHS[index % TITLE_WIDTHS.length]}
      subtitleClassName="w-1/2"
      trailing={
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-3 w-10 rounded-md" />
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
      }
    />
  )
}

/** Le righe dentro una `Card` con `divide-y`: home e storico le usano uguali. */
export function ExpenseRowsSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <ExpenseRowSkeleton key={i} index={i} />
      ))}
    </>
  )
}
