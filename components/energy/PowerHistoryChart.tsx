'use client'

import { useMemo, useRef, useState } from 'react'
import { formatKwh, formatPower, formatTime } from '@/lib/fmt'
import { DEFAULT_LIMIT_KW, type PowerHistory, type PowerPoint } from '@/lib/energy/readings'
import { WINDOW_MS, halfHourRows, historyScale, hourTicks, nearestIndex, segments, summarize } from '@/lib/energy/history'
import { cn } from '@/lib/utils'

/** Larghezza dello spazio di disegno: le x vanno da 0 a 1000, le y da 0 a 100. */
const VIEW_W = 1000

/** Un'etichetta sul bordo resta dentro il grafico invece di centrarsi e uscire. */
function edgeAlign(percent: number) {
  if (percent < 12) return 'translate-x-0'
  if (percent > 88) return '-translate-x-full'
  return '-translate-x-1/2'
}

/**
 * La potenza delle ultime 6 ore, un punto al minuto. Una serie sola: niente
 * legenda, il titolo della card la nomina. Linea nell'accento con l'area
 * sotto appena tinta, griglia leggera, il picco segnato. Mouse, dito
 * (trascinando in orizzontale) e tastiera (frecce, Pagina su/giù, Inizio e
 * Fine) muovono un cursore che dice ora e potenza; la tabella sotto ha media
 * e picco per mezz'ora.
 *
 * `live` è l'ultima lettura della batteria: se è più recente dell'ultimo
 * punto di Fastweb la linea arriva fino a lei, così il grafico finisce
 * "adesso" anche tra un aggiornamento della serie e l'altro.
 */
export function PowerHistoryChart({
  history,
  live,
  limitKw,
  stale,
}: {
  history: PowerHistory
  live: PowerPoint | null
  limitKw: number | null
  stale: boolean
}) {
  const plotRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<number | null>(null)

  const points = useMemo(() => {
    const last = history.points[history.points.length - 1]
    const withLive = live && Date.parse(live.at) > Date.parse(last.at) + 30_000 ? [...history.points, live] : history.points
    const end = Date.parse(withLive[withLive.length - 1].at)
    return withLive.filter((p) => Date.parse(p.at) >= end - WINDOW_MS)
  }, [history, live])

  const endMs = Date.parse(points[points.length - 1].at)
  const startMs = endMs - WINDOW_MS
  const summary = summarize(points)!
  const limitWatts = (limitKw ?? DEFAULT_LIMIT_KW) * 1000
  const scale = historyScale(Math.max(summary.peak.watts, history.peakWatts ?? 0), limitWatts)

  const xPct = (iso: string) => ((Date.parse(iso) - startMs) / WINDOW_MS) * 100
  const yPct = (watts: number) => 100 - (Math.min(watts, scale.topWatts) / scale.topWatts) * 100
  const at = (iso: string, watts: number) => `${((xPct(iso) / 100) * VIEW_W).toFixed(1)},${yPct(watts).toFixed(2)}`

  // Un buco di misura spezza linea e area; 360 punti si ridisegnano in un attimo.
  const parts = segments(points)
  const line = parts.map((seg) => seg.map((p, i) => `${i ? 'L' : 'M'}${at(p.at, p.watts)}`).join('')).join('')
  const area = parts
    .map((seg) => `M${at(seg[0].at, 0)}${seg.map((p) => `L${at(p.at, p.watts)}`).join('')}L${at(seg[seg.length - 1].at, 0)}Z`)
    .join('')

  const cursor = active !== null ? points[Math.min(active, points.length - 1)] : null
  const hours = hourTicks(startMs, endMs)

  function moveTo(clientX: number) {
    const rect = plotRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    setActive(nearestIndex(points, startMs + fraction * WINDOW_MS))
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const current = active ?? points.length - 1
    const step = { ArrowLeft: -1, ArrowRight: 1, PageDown: -30, PageUp: 30 }[event.key]
    let next: number | null = null
    if (step !== undefined) next = current + step
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = points.length - 1
    if (next === null) return
    event.preventDefault()
    setActive(Math.min(points.length - 1, Math.max(0, next)))
  }

  const readout = (p: PowerPoint) => `${formatTime(p.at)}, ${formatPower(p.watts)}`

  return (
    <div className={cn('transition-opacity', stale && 'opacity-60')}>
      <dl className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="text-muted">Picco</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatPower(summary.peak.watts)} <span className="font-normal text-muted">alle {formatTime(summary.peak.at)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted">Media</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{formatPower(summary.averageWatts)}</dd>
        </div>
        <div>
          <dt className="text-muted">Consumo</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{formatKwh(summary.kwh)}</dd>
        </div>
      </dl>

      {/* Lo spazio sopra il grafico è dell'etichetta del cursore, che non copre i numeri. */}
      <div className="mt-9 flex gap-2">
        {/* Scala a sinistra: le stesse righe della griglia. */}
        <div aria-hidden className="relative h-44 w-11 shrink-0 text-[11px] text-muted tabular-nums">
          {scale.ticks.map((watts) => (
            <span key={watts} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${yPct(watts)}%` }}>
              {watts === 0 ? '0' : formatPower(watts)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div
            ref={plotRef}
            role="slider"
            tabIndex={0}
            aria-label="Potenza nelle ultime 6 ore"
            aria-valuemin={0}
            aria-valuemax={points.length - 1}
            aria-valuenow={active ?? points.length - 1}
            aria-valuetext={readout(cursor ?? points[points.length - 1])}
            onPointerDown={(e) => moveTo(e.clientX)}
            onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && moveTo(e.clientX)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
            onFocus={() => setActive((a) => a ?? points.length - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={onKeyDown}
            // In verticale il dito scorre la pagina, in orizzontale muove il cursore.
            className="relative h-44 cursor-crosshair touch-pan-y rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            {scale.ticks.map((watts) => (
              <div key={watts} aria-hidden className="absolute inset-x-0 border-t border-border" style={{ top: `${yPct(watts)}%` }} />
            ))}
            {scale.showLimit && (
              <div aria-hidden className="absolute inset-x-0 border-t-2 border-dashed border-border-strong" style={{ top: `${yPct(limitWatts)}%` }}>
                <span className="absolute right-0 -top-5 text-[11px] text-muted">limite {formatPower(limitWatts)}</span>
              </div>
            )}

            <svg aria-hidden viewBox={`0 0 ${VIEW_W} 100`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible text-accent">
              <path d={area} fill="currentColor" fillOpacity={0.14} />
              <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>

            {/* Il picco, segnato anche senza cursore. */}
            <span
              aria-hidden
              className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface"
              style={{ left: `${xPct(summary.peak.at)}%`, top: `${yPct(summary.peak.watts)}%` }}
            />

            {cursor && (
              <>
                <div aria-hidden className="absolute inset-y-0 w-px -translate-x-1/2 bg-foreground/40" style={{ left: `${xPct(cursor.at)}%` }} />
                <span
                  aria-hidden
                  className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-surface"
                  style={{ left: `${xPct(cursor.at)}%`, top: `${yPct(cursor.watts)}%` }}
                />
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute -top-7 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-semibold text-background tabular-nums',
                    edgeAlign(xPct(cursor.at)),
                  )}
                  style={{ left: `${xPct(cursor.at)}%` }}
                >
                  {formatTime(cursor.at)} · {formatPower(cursor.watts)}
                </span>
              </>
            )}
          </div>

          {/* Sotto i 240 px (un telefono da 320) un'ora ogni due, o le etichette si toccano. */}
          <div aria-hidden className="@container relative mt-1.5 h-4 text-[11px] text-muted tabular-nums">
            {hours.map((t) => {
              const left = ((t - startMs) / WINDOW_MS) * 100
              const odd = new Date(t).getUTCHours() % 2 === 1
              return (
                <span
                  key={t}
                  className={cn('absolute top-0 whitespace-nowrap', edgeAlign(left), odd && '@max-[240px]:hidden')}
                  style={{ left: `${left}%` }}
                >
                  {formatTime(new Date(t).toISOString())}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      <details className="mt-4 border-t border-border">
        <summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold">Mezz’ora per mezz’ora</summary>
        <table className="w-full text-sm">
          <caption className="sr-only">Potenza media e di picco per mezz’ora nelle ultime 6 ore</caption>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="py-1 font-medium">Dalle</th>
              <th scope="col" className="py-1 text-right font-medium">Media</th>
              <th scope="col" className="py-1 text-right font-medium">Picco</th>
            </tr>
          </thead>
          <tbody>
            {halfHourRows(points).map((row) => (
              <tr key={row.from} className="border-t border-border">
                <td className="py-2 tabular-nums">{formatTime(row.from)}</td>
                <td className="py-2 text-right tabular-nums">{formatPower(row.averageWatts)}</td>
                <td className="py-2 text-right tabular-nums">{formatPower(row.peakWatts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
