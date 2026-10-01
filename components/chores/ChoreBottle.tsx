'use client'

import { useId, useState, type CSSProperties } from 'react'
import { House, Lightbulb, Plus } from 'lucide-react'
import type { Notch, NotchEntry, NotchHint } from '@/lib/chores/bottle'
import { createLiquid, flatClips, liquidPaths, LIQUID_SHADE, MAX_BUBBLES, NOTCH_PX } from '@/lib/chores/liquid'
import { useBottleLiquid } from '@/lib/chores/use-bottle-liquid'
import { cn } from '@/lib/utils'

interface ChoreBottleProps {
  name: string
  notches: Notch[]
  /** Tap su una tacca piena: dettagli ed eventuale eliminazione. */
  onEntryTap: (entry: NotchEntry) => void
  /** Tap su un suggerimento sbiadito: confermarlo, scartarlo o ritirarlo. */
  onHintTap: (hint: NotchHint) => void
  /** Tap sulla prima tacca vuota: segna (o suggerisce) una faccenda in questa bottiglia. */
  onAdd: () => void
  /** Etichetta del "+" per chi usa uno screen reader. */
  addLabel?: string
}

/**
 * I colori del liquido, tutti dall'accento scelto: lo strato delle faccende
 * va dall'accento in superficie a un tono più profondo sul fondo, il bonus è
 * il contenitore chiaro di sempre. Le percentuali stanno in `LIQUID_SHADE`,
 * dove le controlla il test del contrasto.
 */
const LIQUID_COLORS = {
  '--liquid-top': 'var(--accent)',
  '--liquid-deep': `color-mix(in srgb, var(--accent), var(--accent-soft) ${LIQUID_SHADE.deep}%)`,
  '--liquid-bonus-top': 'var(--accent-muted)',
  '--liquid-bonus-deep': `color-mix(in srgb, var(--accent-muted), var(--accent) ${LIQUID_SHADE.bonusDeep}%)`,
  '--liquid-layer': 'color-mix(in srgb, var(--accent-muted), var(--accent) 35%)',
  '--liquid-shine': 'color-mix(in srgb, var(--accent), white 55%)',
} as CSSProperties

/** Le tre versioni del testo: sul vetro, nel liquido delle faccende, nel bonus. */
type Tone = 'dry' | 'main' | 'bonus'

const TONES: Record<Tone, { entry: string; hint: string; hintBox: string; add: string; idle: string; line: string }> = {
  dry: {
    entry: 'text-foreground',
    hint: 'text-accent-soft/70',
    hintBox: 'border-accent/50 bg-accent-muted/30',
    add: 'text-muted',
    idle: 'text-muted/50',
    line: 'border-border-strong/60',
  },
  main: {
    entry: 'text-accent-foreground',
    hint: 'text-accent-foreground/80',
    hintBox: 'border-accent-foreground/40 bg-accent-foreground/10',
    add: 'text-accent-foreground/80',
    idle: 'text-accent-foreground/50',
    line: 'border-accent-foreground/25',
  },
  bonus: {
    entry: 'text-accent-soft',
    hint: 'text-accent-soft/80',
    hintBox: 'border-accent-soft/40 bg-accent-soft/10',
    add: 'text-accent-soft/80',
    idle: 'text-accent-soft/50',
    line: 'border-accent-soft/25',
  },
}

const HINT_BOX = 'm-1 flex h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)] items-center justify-center gap-1.5 rounded-xl px-2'

/** Le tacche sono bottoni trasparenti: il testo lo disegnano i tre strati sopra. */
const NOTCH_BUTTON = cn(
  'block transition-colors duration-200 hover:bg-foreground/5 active:bg-foreground/10',
  // Anello doppio, chiaro e scuro: si vede sia sul vetro sia nel liquido.
  'focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--accent-foreground),inset_0_0_0_4px_var(--foreground)]',
)

/**
 * Una bottiglia delle faccende, come nello schizzo: tappo, collo, spalla e un
 * corpo a tacche che si riempie dal basso con il nome della faccenda scritto
 * dentro. Le tacche hanno la stessa altezza in tutte le bottiglie e le
 * bottiglie sono allineate in alto: così la tacca bonus di chi lavora da casa
 * finisce sotto il fondo dell'altra, e due bottiglie pari hanno il liquido
 * alla stessa altezza.
 *
 * Le tacche piene sono **liquido** (`useBottleLiquid`, fisica in
 * `lib/chores/liquid.ts`): una faccenda nuova la versa un getto dal collo, il
 * liquido ondeggia quando si inclina o si scuote il telefono e quando si
 * tocca la bottiglia. Il bonus è uno strato più chiaro sul fondo, come prima.
 *
 * A strati, dal basso: l'SVG del liquido; le tacche come bottoni trasparenti
 * (tocchi, nomi accessibili, focus); tre copie decorative dei testi — sul
 * vetro, nel liquido, nel bonus — ognuna ritagliata (`clip-path`) sulla sua
 * regione a ogni fotogramma. Così una scritta che il liquido copre a metà
 * cambia colore esattamente lungo la superficie e resta leggibile da tutte e
 * due le parti.
 *
 * Il corpo è HTML e non SVG perché deve contenere testo che va a capo e si
 * tronca; l'SVG in alto disegna solo la spalla, con un tratto che non si
 * deforma quando la larghezza cambia.
 */
export function ChoreBottle({ name, notches, onEntryTap, onHintTap, onAdd, addLabel }: ChoreBottleProps) {
  const filled = notches.filter((n) => n.entry).length
  const bonusFilled = notches.filter((n) => n.entry && n.bonus).length
  const firstEmpty = notches.findIndex((n) => !n.entry && !n.hint)
  const bonusPx = bonusFilled * NOTCH_PX
  const mainPx = (filled - bonusFilled) * NOTCH_PX

  const groupRef = useBottleLiquid<HTMLDivElement>(bonusPx, mainPx)

  // Il disegno del primo render resta negli attributi: dopo li scrive solo
  // l'animazione, e React non deve rimetterli a ogni faccenda segnata.
  const [initial] = useState(() => {
    const height = notches.length * NOTCH_PX
    return {
      height,
      paths: liquidPaths(createLiquid({ width: 100, height, bonus: bonusPx, main: mainPx })),
      clips: flatClips(height, bonusPx, mainPx),
    }
  })
  const uid = `liquid${useId().replace(/[^\w-]/g, '')}`

  return (
    <figure className="mx-auto flex w-full min-w-0 max-w-52 flex-col items-stretch">
      <figcaption className="mb-2 text-center font-display text-2xl font-semibold text-foreground">
        {name}
      </figcaption>

      <div
        ref={groupRef}
        role="group"
        aria-label={`Bottiglia di ${name}: ${filled} tacche piene su ${notches.length}`}
        style={LIQUID_COLORS}
      >
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
          {/* Il getto che versa una faccenda nuova: esce da sotto il tappo. */}
          <rect data-liquid="neck-stream" width={0} height={0} />
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

        <div
          data-liquid="body"
          className="relative overflow-hidden rounded-b-[28px] border-2 border-t-0 border-border-strong bg-surface"
        >
          <svg
            data-liquid="svg"
            viewBox={`0 0 100 ${initial.height}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 size-full"
            aria-hidden
          >
            <defs>
              <linearGradient id={`${uid}-main`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: 'var(--liquid-top)' }} />
                <stop offset="1" style={{ stopColor: 'var(--liquid-deep)' }} />
              </linearGradient>
              <linearGradient id={`${uid}-bonus`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: 'var(--liquid-bonus-top)' }} />
                <stop offset="1" style={{ stopColor: 'var(--liquid-bonus-deep)' }} />
              </linearGradient>
              {/* Il vetro: bordi un po' più profondi e un riflesso verticale. */}
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" style={{ stopColor: 'var(--accent-soft)', stopOpacity: LIQUID_SHADE.glassEdge / 100 }} />
                <stop offset="0.12" style={{ stopColor: 'var(--accent-soft)', stopOpacity: 0 }} />
                <stop offset="0.15" style={{ stopColor: 'white', stopOpacity: 0 }} />
                <stop offset="0.21" style={{ stopColor: 'white', stopOpacity: LIQUID_SHADE.glassShine / 100 }} />
                <stop offset="0.29" style={{ stopColor: 'white', stopOpacity: 0 }} />
                <stop offset="0.86" style={{ stopColor: 'var(--accent-soft)', stopOpacity: 0 }} />
                <stop offset="1" style={{ stopColor: 'var(--accent-soft)', stopOpacity: LIQUID_SHADE.glassEdge / 100 }} />
              </linearGradient>
            </defs>
            <path data-liquid="fill" d={initial.paths.liquid} fill={`url(#${uid}-main)`} />
            <path data-liquid="glass" d={initial.paths.main} fill={`url(#${uid}-glass)`} />
            <path data-liquid="bonus" d={initial.paths.bonus} fill={`url(#${uid}-bonus)`} />
            <path
              data-liquid="layer"
              d={initial.paths.layer}
              fill="none"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              style={{ stroke: 'var(--liquid-layer)' }}
            />
            <path
              data-liquid="surface"
              d={initial.paths.surface}
              fill="none"
              strokeWidth={1.5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{ stroke: 'var(--liquid-shine)' }}
            />
            <rect data-liquid="stream" width={0} height={0} />
            {Array.from({ length: MAX_BUBBLES }, (_, i) => (
              <circle key={i} data-liquid="bubble" r={0} style={{ fill: 'rgb(255 255 255 / 0.45)' }} />
            ))}
          </svg>

          <ol className="relative flex flex-col-reverse">
            {notches.map((notch, i) => (
              <li key={i} className={cn('h-14', i > 0 && 'border-b border-transparent')}>
                {notch.entry ? (
                  <button
                    type="button"
                    onClick={() => onEntryTap(notch.entry!)}
                    aria-label={notch.bonus ? `Bonus: ${notch.entry.name}` : notch.entry.name}
                    className={cn(NOTCH_BUTTON, 'size-full')}
                  />
                ) : notch.hint ? (
                  <button
                    type="button"
                    onClick={() => onHintTap(notch.hint!)}
                    aria-label={`Suggerimento: ${notch.hint.name}`}
                    className={cn(NOTCH_BUTTON, HINT_BOX)}
                  />
                ) : i === firstEmpty ? (
                  <button
                    type="button"
                    onClick={onAdd}
                    aria-label={addLabel ?? `Segna una faccenda di ${name}`}
                    className={cn(NOTCH_BUTTON, 'size-full')}
                  />
                ) : null}
              </li>
            ))}
          </ol>

          <NotchFaces tone="dry" notches={notches} firstEmpty={firstEmpty} clip={initial.clips.air} />
          <NotchFaces tone="main" notches={notches} firstEmpty={firstEmpty} clip={initial.clips.main} />
          <NotchFaces tone="bonus" notches={notches} firstEmpty={firstEmpty} clip={initial.clips.bonus} />
        </div>
      </div>
    </figure>
  )
}

/** Una copia decorativa dei testi delle tacche, nel colore di una regione. */
function NotchFaces({ tone, notches, firstEmpty, clip }: { tone: Tone; notches: Notch[]; firstEmpty: number; clip: string }) {
  const t = TONES[tone]
  return (
    <div
      data-liquid={`face-${tone}`}
      aria-hidden
      className="pointer-events-none absolute inset-0 flex select-none flex-col-reverse"
      style={{ clipPath: clip }}
    >
      {notches.map((notch, i) => (
        <div key={i} className={cn('h-14 shrink-0', i > 0 && cn('border-b border-dashed', t.line))}>
          {notch.entry ? (
            <div className={cn('flex size-full items-center justify-center gap-1.5 px-2 text-sm font-semibold', t.entry)}>
              {notch.bonus && <House className="size-3.5 shrink-0" />}
              <span className="truncate">{notch.entry.name}</span>
            </div>
          ) : notch.hint ? (
            <div className={cn(HINT_BOX, 'border border-dashed text-sm font-medium', t.hintBox, t.hint)}>
              <Lightbulb className="size-3.5 shrink-0" />
              <span className="truncate">{notch.hint.name}</span>
            </div>
          ) : i === firstEmpty ? (
            <div className={cn('flex size-full items-center justify-center gap-1.5 text-sm', t.add)}>
              {notch.bonus ? <House className="size-4" /> : <Plus className="size-4" />}
              {notch.bonus && <span>bonus</span>}
            </div>
          ) : (
            <div className={cn('flex size-full items-center justify-center', t.idle)}>
              {notch.bonus && <House className="size-4" />}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
