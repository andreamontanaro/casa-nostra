import { Skeleton, SkeletonPage } from '@/components/ui/Skeleton'

/**
 * Scheletro delle faccende: due bottiglie con la geometria di `ChoreBottle`
 * (spalla da 64px, tacche da 56px), la seconda una tacca più lunga come nei
 * giorni feriali, poi il messaggio e il bottone.
 */
export default function FaccendeLoading() {
  return (
    <SkeletonPage className="flex flex-col gap-6 px-4 pt-6 pb-24" label="Caricamento delle faccende">
      <header className="px-1">
        <Skeleton className="h-9 w-52 rounded-lg" />
      </header>

      <div className="grid grid-cols-2 items-start gap-4 sm:gap-8">
        {[5, 6].map((notches) => (
          <div key={notches} className="flex flex-col items-stretch">
            <Skeleton className="mx-auto mb-2 h-8 w-20 rounded-lg" />
            <Skeleton className="mx-auto h-16 w-2/5 rounded-t-2xl" />
            <Skeleton className="rounded-b-[28px]" style={{ height: `${notches * 3.5}rem` }} />
          </div>
        ))}
      </div>

      <Skeleton className="h-20 rounded-3xl" />
      <Skeleton className="h-13 rounded-full" />
    </SkeletonPage>
  )
}
