import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Pencil,
  Fuel,
  Plus,
  Car as CarIcon,
  Calendar,
  Droplet,
} from 'lucide-react'
import { getCarDetail } from '@/lib/queries-cars'
import { computeConsumption, fuelTotals, computeOdometerConsumptionStats } from '@/lib/cars'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { OdometerSection } from './OdometerSection'
import {
  FUEL_LABELS,
  FUEL_ICON,
  formatEur,
  formatConsumption,
  formatLiters,
  formatDate,
} from '@/lib/fmt'

export default async function CarDetailPage({
  params,
}: {
  params: Promise<{ carId: string }>
}) {
  const { carId } = await params
  const detail = await getCarDetail(carId)
  if (!detail) notFound()

  const { car, photoUrl, fuelEntries, odometerReadings, currentKm } = detail
  const consumption = computeConsumption(fuelEntries)
  const odoConsumption = computeOdometerConsumptionStats(odometerReadings)
  const totals = fuelTotals(fuelEntries)
  const recent = fuelEntries.slice(0, 5)

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-4">
      <div className="flex items-center justify-between">
        <Link
          href="/auto"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Garage
        </Link>
        <Link
          href={`/auto/${car.id}/modifica`}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent"
        >
          <Pencil className="size-4" />
          Modifica
        </Link>
      </div>

      {/* Foto + titolo */}
      <Card className="overflow-hidden p-0">
        <div className="relative aspect-[16/9] w-full bg-surface-raised">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={car.model} className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-muted">
              <CarIcon className="size-10" />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold text-foreground">{car.model}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-base leading-none">
                {FUEL_ICON[car.fuel_type]}
              </span>
              {FUEL_LABELS[car.fuel_type]}
            </span>
            {car.year != null && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Calendar className="size-4" />
                {car.year}
              </span>
            )}
            {car.tank_capacity != null && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Droplet className="size-4" />
                {formatLiters(car.tank_capacity)}
              </span>
            )}
          </div>
        </div>
      </Card>

      <OdometerSection
        carId={car.id}
        currentKm={currentKm}
        readings={odometerReadings}
      />

      {/* Consumi sintesi */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Consumi</p>
          <Link href="/auto/consumi" className="text-xs font-medium text-accent">
            Vedi grafici
          </Link>
        </CardHeader>
        <CardContent>
          {consumption.avgLPer100km != null ? (
            <div className="grid grid-cols-3 gap-3 rounded-2xl bg-surface-raised p-3 text-center">
              <Stat
                label="Medio"
                value={formatConsumption(consumption.avgLPer100km)}
              />
              <Stat
                label="km/L"
                value={
                  consumption.avgKmPerL != null
                    ? consumption.avgKmPerL.toLocaleString('it-IT')
                    : '—'
                }
                bordered
              />
              <Stat
                label="€/km"
                value={
                  consumption.avgCostPerKm != null
                    ? formatEur(consumption.avgCostPerKm)
                    : '—'
                }
              />
            </div>
          ) : odoConsumption.avgLPer100km != null ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-surface-raised p-3 text-center">
                <Stat
                  label="Medio"
                  value={formatConsumption(odoConsumption.avgLPer100km)}
                />
                <Stat
                  label="km/L"
                  value={
                    odoConsumption.avgKmPerL != null
                      ? odoConsumption.avgKmPerL.toLocaleString('it-IT')
                      : '—'
                  }
                  bordered
                />
                <Stat
                  label="€/km"
                  value="—"
                />
              </div>
              <p className="text-center text-xs text-muted">
                Calcolato dalle letture contachilometri (computer di bordo)
              </p>
            </div>
          ) : (
            <p className="py-2 text-sm text-muted">
              Servono almeno due rifornimenti &quot;a pieno&quot; o letture contachilometri con consumo registrato per calcolare il consumo.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ultimi rifornimenti */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Ultimi rifornimenti
          </p>
          <span className="text-xs text-muted tabular-nums">
            {totals.count} · {formatEur(totals.cost)}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              Nessun rifornimento registrato.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((e) => (
                <Link
                  key={e.id}
                  href={`/auto/rifornimenti/${e.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 active:bg-surface-raised transition-colors"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-muted">
                    <Fuel className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium tabular-nums text-foreground">
                      {formatLiters(e.liters)}
                    </p>
                    <p className="text-xs text-muted">{formatDate(e.entry_date)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatEur(e.total_cost)}
                  </span>
                </Link>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Link
        href={`/auto/rifornimenti/nuovo?car=${car.id}`}
        aria-label="Nuovo rifornimento"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-fab active:scale-95 transition-transform"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </Link>
    </div>
  )
}

function Stat({
  label,
  value,
  bordered,
}: {
  label: string
  value: string
  bordered?: boolean
}) {
  return (
    <div className={bordered ? 'border-x border-border' : undefined}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}
