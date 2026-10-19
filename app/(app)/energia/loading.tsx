import { Skeleton, SkeletonPage } from '@/components/ui/Skeleton'

/**
 * Scheletro di Energia: titolo, la card della batteria a tutta larghezza
 * (numero, riga del limite, batteria da 96 px, scala, frase), quella delle
 * ultime 6 ore (tre numeri e il grafico da 176 px), poi le card dei 7 giorni
 * e degli apparecchi, affiancate su desktop come nella pagina.
 */
export default function EnergiaLoading() {
  return (
    <SkeletonPage className="space-y-5 px-4 pt-6 pb-24 lg:pb-8" label="Caricamento dei consumi">
      <header>
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="mt-2 h-4 w-40" />
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-surface p-5 lg:col-span-2">
          <Skeleton className="mb-3 h-4 w-40" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-44" />
          <Skeleton className="mt-5 h-24 rounded-[22px]" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-4 h-4 w-52" />
        </div>
        <div className="rounded-3xl border border-border bg-surface p-5 lg:col-span-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 mb-4 h-3 w-48" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="mt-5 h-44 rounded-2xl" />
        </div>
        {[0, 1].map((card) => (
          <div key={card} className="rounded-3xl border border-border bg-surface p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-40 rounded-2xl" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  )
}
