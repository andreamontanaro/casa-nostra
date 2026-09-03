'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { ChoreIcon } from '@/components/ChoreIcon'
import { CelebrationBurst } from '@/components/chores/CelebrationBurst'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { springSnappy } from '@/lib/motion'
import { choreAreaSolid } from '@/lib/chores/areaTheme'
import { cn } from '@/lib/utils'

interface ChoreRowProps {
  area: string
  title: string
  subtitle: string
  xp: number
  onComplete: () => void
  pending?: boolean
  className?: string
}

/**
 * Riga "Da fare" / "Gesti": nome, ultima volta, e un bottone "Fatto" che
 * registra in un tap. Nessuna conferma: non è un'azione distruttiva, e la
 * conferma comprometterebbe l'obiettivo dei 5 secondi (AGENTS.md). L'XP è in
 * una monetina dorata (valuta del gioco, mai confusa con gli euro delle
 * spese), il bottone "rimbalza" al tap invece di limitarsi a cambiare stato.
 */
export function ChoreRow({
  area,
  title,
  subtitle,
  xp,
  onComplete,
  pending = false,
  className,
}: ChoreRowProps) {
  const [celebrating, setCelebrating] = useState(false)

  function handleClick() {
    setCelebrating(true)
    onComplete()
  }

  return (
    <motion.div
      className={cn('relative flex w-full items-center gap-3 px-4 py-3', className)}
      animate={celebrating ? { backgroundColor: 'var(--positive-muted)' } : { backgroundColor: 'transparent' }}
      transition={{ duration: 0.5 }}
    >
      <span
        aria-hidden
        style={{ backgroundColor: choreAreaSolid(area) }}
        className="absolute inset-y-2 left-0 w-1 rounded-full opacity-70"
      />
      <ChoreIcon area={area} size="md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        <div className="mt-0.5 truncate text-xs text-muted">{subtitle}</div>
      </div>
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-chore-gold-muted px-2 py-0.5 text-[11px] font-bold text-chore-gold-soft">
        <span aria-hidden>🪙</span>
        {xp}
      </span>
      <motion.div
        className="relative shrink-0"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.88 }}
        transition={springSnappy}
      >
        <Button type="button" size="sm" onClick={handleClick} disabled={pending}>
          {pending ? <Spinner size="sm" /> : 'Fatto'}
        </Button>
        <CelebrationBurst active={celebrating} onDone={() => setCelebrating(false)} />
      </motion.div>
    </motion.div>
  )
}
