import type { CSSProperties } from 'react'
import type { Transition } from 'motion/react'

/**
 * Preset di transizione condivisi.
 * Prima di questo modulo ogni componente ridefiniva i propri valori spring
 * (BottomNav, SegmentedControl, BalanceCard, Sheet): qui centralizziamo il
 * "feeling" del movimento per coerenza in tutta l'app.
 */

/** Reattivo e con poco overshoot — toggle, pillole attive, tap. */
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
}

/** Morbido, per entrate/uscite di card e contenuti. */
export const springSoft: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 26,
}

/** Per gli spostamenti di indicatori con layoutId (es. pillola bottom nav). */
export const springLayout: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 28,
}

/** Durata breve per transizioni non-spring (opacity, color). */
export const durationFast = 0.18

/**
 * Entrata a cascata della home: i blocchi arrivano nell'ordine in cui si
 * leggono — saluto, saldo, titolo, poi le spese una dopo l'altra — invece di
 * comparire tutti insieme, così la pagina sembra costruirsi addosso a chi la
 * apre.
 *
 * L'animazione vera è in CSS (`.reveal-up` in `app/globals.css`): qui c'è
 * solo la scala dei ritardi, perché un'entrata in JS lascerebbe la pagina
 * invisibile fino all'idratazione. Un passo da 60 ms tiene l'ultima riga
 * entro i 400 ms: è un benvenuto, non un sipario da aspettare ogni volta che
 * si torna in home.
 */
export const REVEAL_STEP = 60

export function revealDelay(step: number): CSSProperties {
  return { '--reveal-delay': `${Math.round(step * REVEAL_STEP)}ms` } as CSSProperties
}
