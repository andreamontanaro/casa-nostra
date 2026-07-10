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
