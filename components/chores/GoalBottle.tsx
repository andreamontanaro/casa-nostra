'use client'

import { motion } from 'motion/react'
import { springSoft } from '@/lib/motion'

const VIEW_W = 64
const VIEW_H = 120
/** Il liquido non sale mai nel collo, come in una bottiglia vera. */
const FILL_TOP = 34
const FILL_BOTTOM = 116
const NOTCH_COUNT = 5

/** Sagoma di una bottiglia: collo stretto, spalla arrotondata, corpo pieno. */
const BOTTLE_PATH =
  'M 26 4 L 38 4 Q 40 4 40 8 L 40 20 Q 40 26 46 30 L 54 36 Q 58 40 58 46 ' +
  'L 58 108 Q 58 116 50 116 L 14 116 Q 6 116 6 108 L 6 46 Q 6 40 10 36 ' +
  'L 18 30 Q 24 26 24 20 L 24 8 Q 24 4 26 4 Z'

interface GoalBottleProps {
  /** 0–100: livello continuo del liquido (stesso dato della barra di prima). */
  progressPercent: number
  /** Quante delle 5 tacche sono piene, per l'etichetta accessibile. */
  filledNotches: number
}

/**
 * La bottiglia della settimana: si riempie insieme, non a testa — stesso XP
 * di casa che prima alimentava la barra lineare (vedi WeekGoalCard). Le 5
 * tacche sono le stesse soglie del 20% di `WEEKLY_GOAL_XP` di
 * `computeFilledNotches`; qui sono solo linee tratteggiate, il livello del
 * liquido resta continuo per non scattare a gradini.
 */
export function GoalBottle({ progressPercent, filledNotches }: GoalBottleProps) {
  const clampedPercent = Math.max(0, Math.min(100, progressPercent))
  const fillRange = FILL_BOTTOM - FILL_TOP
  const liquidY = FILL_BOTTOM - (clampedPercent / 100) * fillRange

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-28 w-auto shrink-0"
      role="img"
      aria-label={`${filledNotches} tacche su ${NOTCH_COUNT} riempite questa settimana`}
    >
      <defs>
        <clipPath id="goal-bottle-clip">
          <path d={BOTTLE_PATH} />
        </clipPath>
        <linearGradient id="goal-bottle-liquid" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--color-accent)" />
          <stop offset="100%" stopColor="var(--color-chore-gold)" />
        </linearGradient>
      </defs>

      <path d={BOTTLE_PATH} className="fill-surface-sunken" />

      <g clipPath="url(#goal-bottle-clip)">
        <motion.rect
          x={0}
          width={VIEW_W}
          height={VIEW_H}
          fill="url(#goal-bottle-liquid)"
          initial={false}
          animate={{ y: liquidY }}
          transition={{ ...springSoft, bounce: 0.3 }}
        />
        {Array.from({ length: NOTCH_COUNT - 1 }, (_, i) => {
          const notchY = FILL_BOTTOM - (fillRange / NOTCH_COUNT) * (i + 1)
          return (
            <line
              key={i}
              x1={4}
              x2={VIEW_W - 4}
              y1={notchY}
              y2={notchY}
              className="stroke-surface-sunken/70"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          )
        })}
      </g>

      <path d={BOTTLE_PATH} fill="none" className="stroke-border-strong" strokeWidth={2} />
    </svg>
  )
}
