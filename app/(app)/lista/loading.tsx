import { Card } from '@/components/ui/Card'
import { Skeleton, SkeletonChip, SkeletonPage } from '@/components/ui/Skeleton'

/**
 * Riga della lista: il checkbox da 44px a sinistra e il bottone elimina a
 * destra sono i due touch target che danno l'altezza alla riga vera, quindi
 * restano anche qui come cornice.
 */
function ItemRowSkeleton({ nameClassName, quantity }: { nameClassName: string; quantity?: boolean }) {
  return (
    <div className="flex w-full items-center gap-1 pr-3">
      <div className="flex size-11 shrink-0 items-center justify-center">
        <Skeleton className="size-[22px] rounded-md" />
      </div>
      <div className="min-w-0 flex-1 py-3">
        <Skeleton className={`h-5 rounded-md ${nameClassName}`} />
        {quantity && <Skeleton className="mt-1 h-6 w-12 rounded-lg" />}
      </div>
      <div className="flex size-11 shrink-0 items-center justify-center">
        <Skeleton className="size-4 rounded-md" />
      </div>
    </div>
  )
}

/** Un gruppo per tipo di prodotto: intestazione tonale e articoli. */
function CategoryGroupSkeleton({ items }: { items: { name: string; quantity?: boolean }[] }) {
  return (
    <section>
      <Card className="overflow-hidden p-0">
        <div className="flex min-h-10 items-center gap-2 border-b border-border bg-surface-sunken/60 px-4 py-2">
          <Skeleton className="size-4 shrink-0 rounded-md" />
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="ml-auto h-3 w-4 rounded-md" />
        </div>
        <div className="divide-y divide-border">
          {items.map((item, i) => (
            <ItemRowSkeleton key={i} nameClassName={item.name} quantity={item.quantity} />
          ))}
        </div>
      </Card>
    </section>
  )
}

/**
 * Scheletro della lista della spesa, nell'ordine fisso di `ShoppingShell`:
 * titolo e conteggio, barra rapida, bottone dello scontrino, chip dei tipi di
 * prodotto e i gruppi. Lo spazio in fondo è quello del FAB.
 */
export default function ListaLoading() {
  return (
    <SkeletonPage
      className="flex flex-col gap-6 px-4 pt-6 pb-24"
      label="Caricamento della lista della spesa"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-4 w-20 rounded-md" />
      </header>

      {/* Barra rapida: campo e bottone "+" hanno l'altezza di quelli veri. */}
      <div className="flex items-center gap-2 rounded-3xl border border-border bg-surface p-2">
        <div className="flex min-h-12 flex-1 items-center px-3">
          <Skeleton className="h-4 w-44 rounded-md" />
        </div>
        <Skeleton className="h-12 w-13 shrink-0 rounded-full" />
      </div>

      {/* "Controlla uno scontrino": bottone outline, quindi bordo vero. */}
      <div className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-border-strong">
        <Skeleton className="size-5 rounded-md" />
        <Skeleton className="h-4 w-44 rounded-md" />
      </div>

      <div className="-mx-4 overflow-hidden">
        <div className="flex items-center gap-2 px-4">
          {['w-10', 'w-16', 'w-20', 'w-14'].map((width) => (
            <SkeletonChip key={width} className={width} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <CategoryGroupSkeleton
          items={[
            { name: 'w-1/2', quantity: true },
            { name: 'w-2/3' },
            { name: 'w-5/12', quantity: true },
          ]}
        />
        <CategoryGroupSkeleton items={[{ name: 'w-7/12' }, { name: 'w-1/3', quantity: true }]} />
      </div>

      {/* "Comprati di recente": chiuso, come lo trova chi apre la pagina. */}
      <div className="rounded-3xl border border-border bg-surface p-4">
        <div className="flex min-h-11 items-center">
          <Skeleton className="h-4 w-56 rounded-md" />
        </div>
      </div>
    </SkeletonPage>
  )
}
