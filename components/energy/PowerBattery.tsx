import { CircleCheck, TriangleAlert, Zap } from 'lucide-react'
import { formatKw, formatWatts } from '@/lib/fmt'
import { BATTERY_BAND_LABEL, batteryLevel, type BatteryBand, type RealtimeReading } from '@/lib/energy/readings'
import { cn } from '@/lib/utils'

const FILL: Record<BatteryBand, string> = {
  tranquillo: 'bg-accent',
  attenzione: 'bg-warning',
  oltre: 'bg-destructive',
}

const ICON: Record<BatteryBand, { Icon: typeof Zap; className: string }> = {
  tranquillo: { Icon: CircleCheck, className: 'text-accent' },
  attenzione: { Icon: TriangleAlert, className: 'text-warning' },
  oltre: { Icon: Zap, className: 'text-destructive' },
}

/** Un divisorio per ogni kW intero dentro la batteria, come gli elementi di una pila. */
function dividers(limitKw: number): number[] {
  return Array.from({ length: Math.ceil(limitKw) - 1 }, (_, i) => i + 1).filter((kw) => kw < limitKw)
}

/**
 * Le etichette della scala: 0, i kW interi e il limite. Un intero troppo
 * vicino al limite (3 kW con un limite di 3,3) si salta, o si sovrappongono.
 */
function scaleLabels(limitKw: number): number[] {
  return [0, ...dividers(limitKw).filter((kw) => kw / limitKw <= 0.85), limitKw]
}

/**
 * La potenza di adesso come una batteria che si riempie verso il massimo
 * sopportabile dal contatore. Il colore segue la fascia (accento, avviso,
 * oltre il limite) ma non è mai l'unico segnale: sotto c'è sempre la frase,
 * con la sua icona. `stale` attenua tutto quando la lettura è vecchia.
 */
export function PowerBattery({ reading, stale }: { reading: RealtimeReading; stale: boolean }) {
  const level = batteryLevel(reading.watts, reading.limitKw)
  // Anche pochi watt si vedono: un filo di carica, non una batteria vuota.
  const fill = reading.watts > 0 ? Math.max(level.fill, 0.02) : 0
  const { Icon, className: iconClass } = ICON[level.band]
  const labels = scaleLabels(level.limitKw)

  return (
    <figure className={cn('transition-opacity', stale && 'opacity-60')}>
      <figcaption className="sr-only">Potenza assorbita in questo momento</figcaption>
      <p className="flex items-baseline gap-2">
        <span className="font-display text-display-sm font-semibold tabular-nums">{formatWatts(reading.watts)}</span>
      </p>
      <p className="mt-1 text-sm text-muted tabular-nums">
        su {formatKw(level.limitKw)} sopportabili · {level.percent}%
      </p>

      <div
        role="meter"
        aria-label="Potenza rispetto al limite del contatore"
        aria-valuemin={0}
        aria-valuemax={level.limitKw * 1000}
        aria-valuenow={Math.min(reading.watts, level.limitKw * 1000)}
        aria-valuetext={`${formatWatts(reading.watts)}, ${level.percent}% di ${formatKw(level.limitKw)}`}
        className="mt-5 flex items-center"
      >
        <div className="h-24 flex-1 rounded-[22px] border-[3px] border-border-strong p-1.5">
          <div className="relative h-full overflow-hidden rounded-[14px] bg-surface-sunken">
            <div
              className={cn(
                'absolute inset-y-0 left-0 rounded-[12px] transition-[width,background-color] duration-700 ease-out motion-reduce:transition-none',
                FILL[level.band],
              )}
              style={{ width: `${fill * 100}%` }}
            />
            {dividers(level.limitKw).map((kw) => (
              <div
                key={kw}
                aria-hidden
                className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-surface"
                style={{ left: `${(kw / level.limitKw) * 100}%` }}
              />
            ))}
          </div>
        </div>
        <div aria-hidden className="ml-1 h-9 w-2.5 rounded-r-md bg-border-strong" />
      </div>

      <div aria-hidden className="relative mt-2 mr-3.5 h-4 text-xs text-muted tabular-nums">
        {labels.map((kw, i) => (
          <span
            key={kw}
            className={cn(
              'absolute top-0 whitespace-nowrap',
              i === 0 ? 'left-0' : i === labels.length - 1 ? 'right-0' : '-translate-x-1/2',
            )}
            style={i === 0 || i === labels.length - 1 ? undefined : { left: `${(kw / level.limitKw) * 100}%` }}
          >
            {i === 0 ? '0' : formatKw(kw)}
          </span>
        ))}
      </div>

      <p className="mt-4 flex items-start gap-2 text-sm font-medium">
        <Icon className={cn('mt-0.5 size-4 shrink-0', iconClass)} aria-hidden />
        {BATTERY_BAND_LABEL[level.band]}
      </p>
    </figure>
  )
}
