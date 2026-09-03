'use client'

import { AnimatePresence, motion } from 'motion/react'

interface CelebrationBurstProps {
  active: boolean
  onDone: () => void
  emoji?: string
}

/**
 * Piccolo "pop" che compare sopra un bottone al tap e sparisce da solo.
 * Puro feedback tattile (principio "il gioco si sente, non si conta"): non
 * rappresenta nessun dato, quindi vive interamente nell'evento che lo
 * innesca — `onAnimationComplete` lo richiude, niente effect né timer.
 */
export function CelebrationBurst({ active, onDone, emoji = '✨' }: CelebrationBurstProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.span
          initial={{ scale: 0.4, opacity: 1, y: 0 }}
          animate={{ scale: 1.6, opacity: 0, y: -18 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          onAnimationComplete={onDone}
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg"
        >
          {emoji}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
