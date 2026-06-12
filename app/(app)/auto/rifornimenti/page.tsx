import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getCarsLite, getFuelEntries } from '@/lib/queries-cars'
import { Card } from '@/components/ui/Card'
import { RifornimentiFiltri } from './RifornimentiFiltri'

export default async function RifornimentiPage() {
  const [entries, cars] = await Promise.all([getFuelEntries(), getCarsLite()])

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <h1 className="text-xl font-semibold text-foreground">Rifornimenti</h1>

      {cars.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-sm text-muted">
            Aggiungi prima un&apos;auto per registrare i rifornimenti.
          </p>
          <Link
            href="/auto/nuova"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-base font-medium text-accent-foreground active:opacity-90"
          >
            <Plus className="size-5" strokeWidth={2.5} />
            Aggiungi auto
          </Link>
        </Card>
      ) : (
        <>
          <RifornimentiFiltri entries={entries} cars={cars} />
          <Link
            href="/auto/rifornimenti/nuovo"
            aria-label="Nuovo rifornimento"
            className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-fab active:scale-95 transition-transform"
          >
            <Plus className="size-6" strokeWidth={2.5} />
          </Link>
        </>
      )}
    </div>
  )
}
