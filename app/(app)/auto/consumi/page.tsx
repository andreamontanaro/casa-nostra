import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getConsumiData } from '@/lib/queries-cars'
import { Card } from '@/components/ui/Card'
import { ConsumiClient } from './ConsumiClient'

export default async function ConsumiPage() {
  const data = await getConsumiData()

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <h1 className="text-xl font-semibold text-foreground">Consumi</h1>

      {data.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-sm text-muted">
            Aggiungi un&apos;auto e qualche rifornimento per vedere consumi e
            percorrenze.
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
        <ConsumiClient data={data} />
      )}
    </div>
  )
}
