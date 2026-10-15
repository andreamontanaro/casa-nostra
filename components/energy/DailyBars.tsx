'use client'

import { useState } from 'react'
import { formatDate, formatDateShort, formatKwh } from '@/lib/fmt'
import type { DailyConsumption } from '@/lib/energy/readings'
import { cn } from '@/lib/utils'

const WEEKDAY = new Intl.DateTimeFormat('it-IT', { weekday: 'short', timeZone: 'Europe/Rome' })
const DAY = new Intl.DateTimeFormat('it-IT', { day: 'numeric', timeZone: 'Europe/Rome' })

/** Mezzogiorno del giorno: lontano dalla mezzanotte, il fuso non lo sposta. */
const noon = (date: string) => new Date(`${date}T12:00:00Z`)

/**
 * Consumo degli ultimi giorni, una barra per giorno. Una serie sola: niente
 * legenda, il titolo della card la nomina. Al passaggio (dito, mouse o
 * tastiera) il valore compare sopra la barra; i numeri di tutti i giorni
 * stanno nella tabella sotto.
 */
export function DailyBars({
  days,
  weekKwh,
  previousWeekKwh,
}: {
  days: DailyConsumption[]
  weekKwh: number | null
  previousWeekKwh: number | null
}) {
  const [active, setActive] = useState<string | null>(null)
  const max = Math.max(...days.map((d) => d.kwh), 0.1)
  const total = weekKwh ?? days.reduce((sum, d) => sum + d.kwh, 0)
  // Confronto con i 7 giorni prima, senza giudizio: niente colori, solo il numero.
  const delta = previousWeekKwh ? Math.round(((total - previousWeekKwh) / previousWeekKwh) * 100) : null
  const range = `${formatDateShort(days[0].date)} – ${formatDateShort(days[days.length - 1].date)}`

  return (
    <div>
      <p className="font-display text-xl font-semibold tabular-nums">{formatKwh(total)}</p>
      <p className="text-xs text-muted tabular-nums">{range} · in media {formatKwh(total / days.length)} al giorno</p>
      {delta !== null && previousWeekKwh !== null && (
        <p className="mt-1 text-xs text-muted tabular-nums">
          {delta === 0 ? 'Come' : delta > 0 ? `+${delta}% rispetto a` : `−${Math.abs(delta)}% rispetto a`} i 7 giorni prima ({formatKwh(previousWeekKwh)})
        </p>
      )}

      <div className="mt-6 flex h-40 items-end gap-1" onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}>
        {days.map((day) => {
          const isActive = active === day.date
          return (
            <button
              key={day.date}
              type="button"
              aria-label={`${formatDate(day.date)}: ${formatKwh(day.kwh)}`}
              // Il mouse mostra al passaggio, il dito al tocco: il valore resta
              // finché non si tocca un'altra barra.
              onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(day.date)}
              onFocus={() => setActive(day.date)}
              onClick={() => setActive(day.date)}
              className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span
                aria-hidden
                className={cn('relative w-3/4 max-w-10 rounded-t-[4px] transition-colors', isActive ? 'bg-accent' : 'bg-accent/70')}
                style={{ height: `${Math.max(2, (day.kwh / max) * 112)}px` }}
              >
                {isActive && (
                  <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-semibold text-background tabular-nums">
                    {formatKwh(day.kwh)}
                  </span>
                )}
              </span>
              <span aria-hidden className="text-center text-[11px] leading-tight text-muted">
                {WEEKDAY.format(noon(day.date))}
                <br />
                {DAY.format(noon(day.date))}
              </span>
            </button>
          )
        })}
      </div>

      <details className="mt-4 border-t border-border">
        <summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold">Consumo giorno per giorno</summary>
        <table className="w-full text-sm">
          <caption className="sr-only">Consumo di elettricità per giorno</caption>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="py-1 font-medium">Giorno</th>
              <th scope="col" className="py-1 text-right font-medium">Consumo</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((day) => (
              <tr key={day.date} className="border-t border-border">
                <td className="py-2">{formatDate(day.date)}</td>
                <td className="py-2 text-right tabular-nums">{formatKwh(day.kwh)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
