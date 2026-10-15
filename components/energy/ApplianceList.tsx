import {
  AirVent,
  CookingPot,
  Flame,
  Lightbulb,
  Microwave,
  Plug,
  Refrigerator,
  Tv,
  WashingMachine,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { formatKwh } from '@/lib/fmt'
import type { ApplianceConsumption } from '@/lib/energy/readings'

// Le etichette sono quelle di Fastweb: l'icona si sceglie per parola chiave.
const ICONS: [RegExp, LucideIcon][] = [
  [/frig|congel|freezer/i, Refrigerator],
  [/lavatr|lavastov|lavastovigl|asciug/i, WashingMachine],
  [/micro/i, Microwave],
  [/forno|piano|cucin|induz/i, CookingPot],
  [/scald|boiler|stufa|riscald/i, Flame],
  [/clima|condiz|pompa/i, AirVent],
  [/tv|televis|intratten/i, Tv],
  [/luc|illumin/i, Lightbulb],
  [/stand.?by|attesa/i, Plug],
]

function iconFor(name: string): LucideIcon {
  return ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? Zap
}

/**
 * Ripartizione per apparecchio, dal più al meno energivoro: nome, kWh e quota
 * sul totale, con una barra sottile nella stessa tinta per tutti (una sola
 * misura, la quantità). Ogni riga dice tutto anche senza la barra.
 */
export function ApplianceList({ appliances }: { appliances: ApplianceConsumption[] }) {
  const sorted = [...appliances].sort((a, b) => b.kwh - a.kwh)
  const total = sorted.reduce((sum, a) => sum + a.kwh, 0)
  const max = Math.max(...sorted.map((a) => a.kwh), 0.1)

  return (
    <ul className="space-y-3">
      {sorted.map((appliance) => {
        const Icon = iconFor(appliance.name)
        const share = total > 0 ? Math.round((appliance.kwh / total) * 100) : 0
        return (
          <li key={appliance.name} className="flex min-h-11 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-muted text-accent-soft">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium capitalize">{appliance.name}</span>
                <span className="shrink-0 tabular-nums">
                  {formatKwh(appliance.kwh)} <span className="text-muted">· {share}%</span>
                </span>
              </div>
              <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                <div className="h-full rounded-full bg-accent/70" style={{ width: `${(appliance.kwh / max) * 100}%` }} />
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
