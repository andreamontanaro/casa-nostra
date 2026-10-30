'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { BALANCE_EVEN_CLASS, balanceAmountClass } from '@/components/BalanceCard'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import { collapseProgress, flight, pathData, stripOpacity, unroll } from '@/lib/collapsing-balance'
import { categoryHex, formatEur } from '@/lib/fmt'
import type { OpenExpenseWithContribution } from '@/lib/queries'
import { categoryTotals, ringArcs, ringSegments } from '@/lib/spending'
import { useDarkTheme } from '@/lib/use-dark-theme'
import type { Tables } from '@/types/database'

interface Props {
  rows: Tables<'v_user_open_balance'>[]
  currentUserId: string
  /** Le spese aperte: le stesse fette dell'anello. */
  expenses: OpenExpenseWithContribution[]
  /** La scritta al centro dell'anello (vedi `BalanceCard.headlineRef`). */
  headline: RefObject<HTMLElement | null>
  /** Il riquadro dell'anello (vedi `SpendingRing.frameRef`). */
  ring: RefObject<HTMLElement | null>
}

/**
 * Il saldo resta sempre a vista in home. Scorrendo verso il basso l'anello
 * delle categorie si srotola in una barra orizzontale, come una barra di
 * stato, incollata sotto la top bar, e la cifra al suo centro vola alla
 * sinistra della barra. Tornando su fanno il viaggio inverso; un tocco sulla
 * barra riporta in cima, dove c'è la card intera.
 *
 * La transizione è legata allo scorrimento, non a una durata. Durante il
 * viaggio l'anello vero e la sua cifra si nascondono e al loro posto si
 * disegnano copie `position: fixed`: un tracciato SVG che si stende
 * (`unroll`) e la cifra che vola (`flight`), con la geometria di
 * `lib/collapsing-balance.ts`. Gli stili si scrivono direttamente nel DOM a
 * ogni fotogramma di scroll, senza far ridisegnare React. A viaggio fermo le
 * copie sono nascoste e si vedono l'anello vero o la barra vera. Con «riduci
 * movimento» niente viaggio: la barra compare quando la cifra le arriva sotto.
 */
export function BalanceStrip({ rows, currentUserId, expenses, headline, ring }: Props) {
  const dark = useDarkTheme()
  const strip = useRef<HTMLButtonElement>(null)
  const target = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const clone = useRef<HTMLSpanElement>(null)
  const overlay = useRef<SVGSVGElement>(null)

  const me = rows.find((r) => r.user_id === currentUserId)
  const other = rows.find((r) => r.user_id !== currentUserId)
  const net = me?.net_position ?? 0
  const amount = Math.abs(net)
  const otherName = other?.display_name?.split(' ')[0] ?? 'il partner'
  const caption = net > 0 ? `Devi ricevere da ${otherName}` : net < 0 ? `Devi dare a ${otherName}` : null
  const arcs = ringArcs(ringSegments(categoryTotals(expenses)))
  // Le fette nuove nascono senza tracciato: vanno disegnate subito.
  const arcsKey = arcs.map((a) => `${a.category}:${a.length}`).join()

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let touched: HTMLElement[] = []

    function update() {
      frame = 0
      const hero = headline.current
      const frameEl = ring.current
      const ringEl = frameEl?.firstElementChild as HTMLElement | null | undefined
      const centerEl = frameEl?.lastElementChild as HTMLElement | null | undefined
      const stripEl = strip.current
      const targetEl = target.current
      const barEl = bar.current
      const cloneEl = clone.current
      const overlayEl = overlay.current
      if (!hero || !ringEl || !centerEl || !stripEl || !targetEl || !barEl || !cloneEl || !overlayEl) return
      touched = [hero, ringEl, centerEl]

      const heroRect = hero.getBoundingClientRect()
      const targetRect = targetEl.getBoundingClientRect()
      const p = collapseProgress(heroRect, targetRect, window.scrollY)
      const still = reduce.matches
      const moving = !still && p > 0 && p < 1
      const gone = !still && p > 0

      hero.style.opacity = gone ? '0' : ''
      ringEl.style.visibility = gone ? 'hidden' : ''
      // «Devi dare», «a Fede»: se ne vanno subito, la cifra vola da sola.
      centerEl.style.opacity = gone ? String(Math.max(0, 1 - p / 0.25)) : ''
      cloneEl.style.visibility = moving ? 'visible' : 'hidden'
      overlayEl.style.visibility = moving ? 'visible' : 'hidden'
      if (moving) {
        const f = flight(heroRect, targetRect, { width: cloneEl.offsetWidth, height: cloneEl.offsetHeight }, p)
        cloneEl.style.transform = `translate3d(${f.x}px, ${f.y}px, 0) scale(${f.scale})`
        const { points, strokeWidth } = unroll(ringEl.getBoundingClientRect(), barEl.getBoundingClientRect(), p)
        const d = pathData(points)
        for (const path of overlayEl.children) {
          path.setAttribute('d', d)
          path.setAttribute('stroke-width', strokeWidth.toFixed(2))
        }
      }
      stripEl.style.setProperty('--strip', String(still ? Number(p >= 1) : stripOpacity(p)))
      stripEl.style.setProperty('--strip-bar', String(Number(p >= 1)))
      stripEl.inert = p < 1
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update)
    }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    reduce.addEventListener('change', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      reduce.removeEventListener('change', schedule)
      // La scritta può cambiare elemento (cifra ↔ «Siete in pari»): quella
      // vecchia torna com'era, la nuova la sistema il prossimo `update`.
      for (const el of touched) {
        el.style.opacity = ''
        el.style.visibility = ''
      }
    }
  }, [headline, ring, net, arcsKey])

  if (!me || !other) return null

  return (
    <>
      {/* Alta zero: sta incollata sotto la top bar senza spostare la pagina. */}
      <div className="pointer-events-none sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 -mx-4 h-0">
        <button
          ref={strip}
          type="button"
          inert
          onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
          aria-label={`Saldo: ${caption ? `${caption.toLowerCase()} ${formatEur(amount)}` : 'siete in pari'}. Torna in cima`}
          className="pointer-events-auto relative flex w-full items-center gap-4 px-5 py-2 text-left [&[inert]]:pointer-events-none"
        >
          <span
            aria-hidden
            className="absolute inset-0 border-b border-border bg-background/95 backdrop-blur-md opacity-[var(--strip,0)] motion-reduce:transition-opacity"
          />
          <span aria-hidden className="relative flex shrink-0 flex-col">
            <span ref={target} className="self-start opacity-[var(--strip-bar,0)] motion-reduce:transition-opacity">
              {net === 0
                ? <span className="font-display text-sm font-semibold">Siete in pari</span>
                : <AmountDisplay value={amount} className="text-lg leading-tight" />}
            </span>
            {caption && (
              <span className="text-[11px] font-medium leading-tight text-muted opacity-[var(--strip,0)] motion-reduce:transition-opacity">
                {caption}
              </span>
            )}
          </span>
          {/* Le fette in fila, dalla destra: è l'anello steso (vedi `unroll`). */}
          <span
            ref={bar}
            aria-hidden
            className="relative h-2 min-w-0 flex-1 bg-surface-sunken opacity-[var(--strip-bar,0)] motion-reduce:transition-opacity"
          >
            {arcs.map((arc) => (
              <span
                key={arc.category}
                className="absolute inset-y-0"
                style={{ right: `${arc.offset}%`, width: `${arc.length}%`, background: categoryHex(arc.category, dark) }}
              />
            ))}
          </span>
        </button>
      </div>

      {/* Le copie in viaggio: l'anello che si stende e la cifra che vola. */}
      <svg ref={overlay} aria-hidden className="pointer-events-none invisible fixed inset-0 z-30 size-full overflow-visible">
        <path fill="none" stroke="var(--surface-sunken)" pathLength="100" />
        {arcs.map((arc) => (
          <path
            key={arc.category}
            fill="none"
            stroke={categoryHex(arc.category, dark)}
            pathLength="100"
            strokeDasharray={`${arc.length} 100`}
            strokeDashoffset={-arc.offset}
          />
        ))}
      </svg>
      <span
        ref={clone}
        aria-hidden
        className="pointer-events-none invisible fixed top-0 left-0 z-30 origin-top-left whitespace-nowrap will-change-transform"
      >
        {net === 0
          ? <span className={BALANCE_EVEN_CLASS}>Siete in pari</span>
          : <AmountDisplay value={amount} className={balanceAmountClass(amount)} />}
      </span>
    </>
  )
}
