import Link from 'next/link'
import { Plus, Car as CarIcon, Gauge, Droplet } from 'lucide-react'
import { getGarage } from '@/lib/queries-cars'
import { Card } from '@/components/ui/Card'
import { formatKm, formatConsumption, FUEL_LABELS, FUEL_ICON } from '@/lib/fmt'

export default async function GaragePage() {
  const garage = await getGarage()

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <h1 className="text-xl font-semibold text-foreground">Garage</h1>

      {garage.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-raised text-muted">
            <CarIcon className="size-7" />
          </span>
          <p className="text-sm text-muted">
            Non hai ancora aggiunto nessuna auto.
          </p>
          <Link
            href="/auto/nuova"
            className="mt-1 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-base font-medium text-accent-foreground active:opacity-90"
          >
            <Plus className="size-5" strokeWidth={2.5} />
            Aggiungi auto
          </Link>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {garage.map(({ car, photoUrl, currentKm, avgLPer100km }) => (
            <li key={car.id}>
              <Link href={`/auto/${car.id}`} className="block active:scale-[0.99] transition-transform">
                <Card className="overflow-hidden p-0">
                  <div className="relative aspect-[16/9] w-full bg-surface-raised">
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoUrl}
                        alt={car.model}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-muted">
                        <CarIcon className="size-10" />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-base font-semibold text-foreground">
                        {car.model}
                      </p>
                      {car.year != null && (
                        <span className="shrink-0 text-xs text-muted tabular-nums">
                          {car.year}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-sm leading-none">
                          {FUEL_ICON[car.fuel_type]}
                        </span>
                        {FUEL_LABELS[car.fuel_type]}
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Gauge className="size-3.5" />
                        {formatKm(currentKm)}
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Droplet className="size-3.5" />
                        {avgLPer100km != null
                          ? formatConsumption(avgLPer100km)
                          : '—'}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/auto/nuova"
        aria-label="Aggiungi auto"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg active:opacity-80 transition-opacity"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </Link>
    </div>
  )
}
