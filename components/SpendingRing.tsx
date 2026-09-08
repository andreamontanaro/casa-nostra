'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { CATEGORY_LABELS, categoryHex, formatEur } from '@/lib/fmt'
import { useDarkTheme } from '@/lib/use-dark-theme'
import { cn } from '@/lib/utils'
import type { CategoryTotal } from '@/lib/spending'

interface Props {
  categories: CategoryTotal[]
  children: React.ReactNode
  compact?: boolean
  label?: string
  categoryHref?: (category: string) => string
}

export function SpendingRing({ categories, children, label = 'Spese da regolare', categoryHref, compact = false }: Props) {
  const dark = useDarkTheme()
  const id = useId()
  const [selected, setSelected] = useState<string | null>(null)
  const total = categories.reduce((sum, item) => sum + Math.round(item.total * 100), 0) / 100
  const active = categories.find((item) => item.category === selected)
  const segments = categories.map((item, index) => ({
    ...item,
    share: total > 0 ? item.total / total * 100 : 0,
    offset: total > 0 ? categories.slice(0, index).reduce((sum, item) => sum + item.total, 0) / total * 100 : 0,
  }))

  return (
    <div className="min-w-0">
      <div className={cn("relative mx-auto aspect-square w-full", compact ? "max-w-[11.5rem]" : "max-w-[17rem]")}>
        <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-labelledby={id}>
          <title id={id}>{`${label}: ${formatEur(total)}. La composizione delle spese è distinta dal saldo al centro. ${categories.map((c) => `${CATEGORY_LABELS[c.category]}: ${formatEur(c.total)}`).join('; ')}`}</title>
          <circle cx="100" cy="100" r="89" fill="none" stroke="var(--surface-sunken)" strokeWidth="11" />
          {segments.map((item) => (
            <circle key={item.category} cx="100" cy="100" r="89" pathLength="100" fill="none"
              stroke={categoryHex(item.category, dark)} strokeWidth={selected === item.category ? 15 : 11}
              strokeDasharray={`${Math.max(0, item.share - (segments.length > 1 ? Math.min(1, item.share * .12) : 0))} 100`}
              strokeDashoffset={-item.offset}
              className={cn("transition-[stroke-width,opacity] duration-150", !compact && "cursor-pointer")}
              opacity={active && selected !== item.category ? .4 : 1}
              onClick={compact ? undefined : () => setSelected(selected === item.category ? null : item.category)}
              aria-hidden />
          ))}
        </svg>
        <div className={cn("absolute flex min-w-0 flex-col items-center justify-center text-center", compact ? "inset-6" : "inset-9")}>
          {children}
        </div>
      </div>
      {!compact && <><p className="mt-2 text-center text-sm text-muted">{label} <span className="whitespace-nowrap font-semibold text-foreground">{formatEur(total)}</span></p>
      {categories.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-1" role="group" aria-label="Categorie delle spese">
          {categories.map((item) => (
            <button key={item.category} type="button" aria-pressed={selected === item.category}
              onClick={() => setSelected(selected === item.category ? null : item.category)}
              className={cn('flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-semibold transition-colors',
                selected === item.category ? 'bg-surface-sunken text-foreground' : 'text-muted hover:bg-surface-raised')}
              aria-label={`${CATEGORY_LABELS[item.category]}: ${formatEur(item.total)}, ${Math.round(item.total / total * 100)} per cento`}>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: categoryHex(item.category, dark) }} aria-hidden />
              {CATEGORY_LABELS[item.category]}
            </button>
          ))}
        </div>
      )}
      <div aria-live="polite" aria-atomic="true">
        {active && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-raised px-4 py-3 text-sm">
            <div><p className="font-semibold">{CATEGORY_LABELS[active.category]} · {formatEur(active.total)}</p>
              <p className="mt-0.5 text-xs text-muted">{active.count} spese · {Math.round(active.total / total * 100)}% degli importi totali</p></div>
            {categoryHref && <Link className="flex min-h-11 items-center gap-1 font-semibold text-accent" href={categoryHref(active.category)}>Apri spese <ArrowUpRight className="size-4" aria-hidden /></Link>}
          </div>
        )}
      </div></>}
    </div>
  )
}
