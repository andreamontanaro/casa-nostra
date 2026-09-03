'use client'

import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'

interface CelebrationBurstProps {
  active: boolean
  onDone: () => void
  emoji?: string
}

const CONFETTI = ['✨', '🎉', '⭐', '💫']
const PARTICLE_COUNT = 7

/**
 * Coriandoli che esplodono dal bottone al tap: ogni particella vola in una
 * direzione diversa con una sua rotazione e un suo ritardo, per un "pop" da
 * videogioco invece del singolo emoji che si dissolve. Puro feedback
 * tattile — non rappresenta dati, quindi vive interamente nell'evento che lo
 * innesca (nessun effect, nessun timer: `onAnimationComplete` sull'ultima
 * particella richiude tutto).
 */
export function CelebrationBurst({ active, onDone, emoji }: CelebrationBurstProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (i % 2 === 0 ? 0.2 : -0.2)
        const distance = 26 + (i % 3) * 10
        return {
          id: i,
          symbol: emoji ?? CONFETTI[i % CONFETTI.length],
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 10,
          rotate: (i % 2 === 0 ? 1 : -1) * (90 + i * 20),
          delay: i * 0.02,
        }
      }),
    [emoji],
  )

  return (
    <AnimatePresence>
      {active && (
        <span aria-hidden className="pointer-events-none absolute inset-0">
          {particles.map((p, i) => (
            <motion.span
              key={p.id}
              initial={{ x: 0, y: 0, scale: 0.4, opacity: 1, rotate: 0 }}
              animate={{ x: p.x, y: p.y, scale: 1, opacity: 0, rotate: p.rotate }}
              transition={{ duration: 0.6, delay: p.delay, ease: 'easeOut' }}
              onAnimationComplete={i === particles.length - 1 ? onDone : undefined}
              className="absolute inset-0 flex items-center justify-center text-base"
            >
              {p.symbol}
            </motion.span>
          ))}
        </span>
      )}
    </AnimatePresence>
  )
}
