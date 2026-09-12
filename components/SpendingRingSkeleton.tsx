import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

/**
 * Segnaposto di `SpendingRing`. L'anello è un cerchio shimmer con al centro
 * un disco del colore della card: stessa aspect-ratio, stesso spessore
 * relativo (11 su 200 del viewBox) e stessa area centrale del grafico vero,
 * quindi la card del saldo nasce già della sua altezza definitiva.
 */
export function SpendingRingSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          'relative mx-auto aspect-square w-full',
          compact ? 'max-w-[11.5rem]' : 'max-w-[17rem]',
        )}
      >
        <Skeleton className="size-full rounded-full" />
        <div className="absolute inset-[5.5%] rounded-full bg-surface" />
        <div
          className={cn(
            'absolute flex flex-col items-center justify-center gap-2',
            compact ? 'inset-6' : 'inset-9',
          )}
        >
          <Skeleton className="h-3 w-20 rounded-md" />
          <Skeleton className={cn('rounded-lg', compact ? 'h-6 w-24' : 'h-10 w-40')} />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
      </div>

      {/* Solo l'anello grande ha totale e legenda delle categorie sotto. */}
      {!compact && (
        <>
          <div className="mt-2 flex min-h-5 items-center justify-center">
            <Skeleton className="h-4 w-52 rounded-md" />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-1">
            {['w-28', 'w-24', 'w-32', 'w-24'].map((width) => (
              <div key={width} className="flex min-h-11 items-center px-3">
                <Skeleton className={cn('h-4 rounded-md', width)} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
