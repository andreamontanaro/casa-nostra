'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Fuel, Gauge } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { formatDate, formatEur, formatLiters, formatPricePerLiter } from '@/lib/fmt'
import { cn } from '@/lib/utils'
import type { FuelEntryWithCar } from '@/lib/queries-cars'
import type { Tables } from '@/types/database'

type CarLite = Pick<Tables<'cars'>, 'id' | 'model'>

interface RifornimentiFiltriProps {
  entries: FuelEntryWithCar[]
  cars: CarLite[]
}

export function RifornimentiFiltri({ entries, cars }: RifornimentiFiltriProps) {
  const [selected, setSelected] = useState<string>('all')

  const filtered = useMemo(
    () =>
      selected === 'all'
        ? entries
        : entries.filter((e) => e.car_id === selected),
    [entries, selected],
  )

  const groups = useMemo(() => {
    const map = new Map<string, FuelEntryWithCar[]>()
    for (const e of filtered) {
      const list = map.get(e.entry_date)
      if (list) list.push(e)
      else map.set(e.entry_date, [e])
    }
    return [...map.entries()] // già ordinati dal più recente (query desc)
  }, [filtered])

  return (
    <div className="flex flex-col gap-4">
      {cars.length > 1 && (
        <div className="-mx-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 px-4">
            {[{ id: 'all', model: 'Tutte' }, ...cars].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium',
                  'transition-[border-color,background-color,color] duration-150',
                  selected === c.id
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-border bg-surface text-muted hover:border-accent/40',
                )}
              >
                {c.model}
              </button>
            ))}
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <Card className="px-6 py-10 text-center text-sm text-muted">
          Nessun rifornimento registrato.
        </Card>
      ) : (
        groups.map(([date, list]) => (
          <div key={date} className="flex flex-col gap-2">
            <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted">
              {formatDate(date)}
            </p>
            <Card className="divide-y divide-border overflow-hidden p-0">
              {list.map((e) => (
                <Link
                  key={e.id}
                  href={`/auto/rifornimenti/${e.id}`}
                  className="flex items-center gap-3 px-4 py-3 active:bg-surface-raised transition-colors"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-muted">
                    <Fuel className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {e.car?.model ?? 'Auto'}
                      {!e.full_tank && (
                        <span className="ml-2 rounded-full bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-muted">
                          parziale
                        </span>
                      )}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-muted tabular-nums">
                      <span>{formatLiters(e.liters)}</span>
                      <span>·</span>
                      <span>{formatPricePerLiter(e.price_per_liter)}</span>
                      {e.odometer_km != null && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-0.5">
                            <Gauge className="size-3" />
                            {e.odometer_km}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatEur(e.total_cost)}
                  </span>
                </Link>
              ))}
            </Card>
          </div>
        ))
      )}
    </div>
  )
}
