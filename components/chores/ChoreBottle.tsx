'use client'

import { House, Plus } from 'lucide-react'
import type { Notch, NotchEntry } from '@/lib/chores/bottle'
import { cn } from '@/lib/utils'

interface ChoreBottleProps {
  name: string
  notches: Notch[]
  /** Tap su una tacca piena: dettagli ed eventuale eliminazione. */
  onEntryTap: (entry: NotchEntry) => void
  /** Tap sulla prima tacca vuota: segna una faccenda in questa bottiglia. */
  onAdd: () => void
}

/**
 * Una bottiglia delle faccende, come nello schizzo: tappo, collo, spalla e un
 * corpo a tacche che si riempie dal basso con il nome della faccenda scritto
 * dentro. Le tacche hanno la stessa altezza in tutte le bottiglie e le
 * bottiglie sono allineate in alto: così la tacca bonus di chi lavora da casa
 * finisce sotto il fondo dell'altra, e due bottiglie pari hanno il liquido
 * alla stessa altezza.
 *
 * Il corpo è HTML e non SVG perché deve contenere testo che va a capo e si
 * tronca; l'SVG disegna solo la parte alta, con un tratto che non si deforma
 * quando la larghezza cambia.
 */
export function ChoreBottle({ name, notches, onEntryTap, onAdd }: ChoreBottleProps) {
  const filled = notches.filter((n) => n.entry).length
  const firstEmpty = notches.findIndex((n) => !n.entry)

  return (
    <figure className="mx-auto flex w-full min-w-0 max-w-52 flex-col items-stretch">
      <figcaption className="mb-2 text-center font-display text-2xl font-semibold text-foreground">
        {name}
      </figcaption>

      <div role="group" aria-label={`Bottiglia di ${name}: ${filled} tacche piene su ${notches.length}`}>
        {/* 2px di tratto: l'SVG è largo quanto il corpo meno il bordo, così x=0 e x=100 cadono al centro del bordo. */}
        <svg
          viewBox="0 0 100 60"
          preserveAspectRatio="none"
          className="mx-px block h-16 w-[calc(100%-2px)] overflow-visible"
          aria-hidden
        >
          <path
            d="M38 12 V22 C38 36 0 32 0 50 V60 H100 V50 C100 32 62 36 62 22 V12 Z"
            className="fill-surface"
          />
          <path
            d="M38 12 V22 C38 36 0 32 0 50 V60 M62 12 V22 C62 36 100 32 100 50 V60"
            fill="none"
            className="stroke-border-strong"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          <rect
            x={34}
            y={1}
            width={32}
            height={11}
            rx={2}
            className="fill-accent-muted stroke-border-strong"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <ol className="flex flex-col-reverse overflow-hidden rounded-b-[28px] border-2 border-t-0 border-border-strong bg-surface">
          {notches.map((notch, i) => (
            <li
              key={i}
              className={cn('h-14', i > 0 && 'border-b border-dashed border-border-strong/60')}
            >
              {notch.entry ? (
                <button
                  type="button"
                  onClick={() => onEntryTap(notch.entry!)}
                  className={cn(
                    'flex size-full items-center justify-center gap-1.5 px-2 text-sm font-semibold',
                    'transition-[background-color,transform] duration-200 active:scale-[0.98]',
                    notch.bonus ? 'bg-accent-muted text-accent-soft' : 'bg-accent text-accent-foreground',
                  )}
                >
                  {notch.bonus && <House className="size-3.5 shrink-0" aria-label="Bonus:" />}
                  <span className="truncate">{notch.entry.name}</span>
                </button>
              ) : i === firstEmpty ? (
                <button
                  type="button"
                  onClick={onAdd}
                  aria-label={`Segna una faccenda di ${name}`}
                  className="flex size-full items-center justify-center gap-1.5 text-sm text-muted transition-colors hover:bg-surface-raised"
                >
                  {notch.bonus ? <House className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                  {notch.bonus && <span>bonus</span>}
                </button>
              ) : (
                <div className="flex size-full items-center justify-center text-muted/50" aria-hidden>
                  {notch.bonus && <House className="size-4" />}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </figure>
  )
}
