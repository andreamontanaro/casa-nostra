'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { ChoreIcon } from '@/components/ChoreIcon'
import { CelebrationBurst } from '@/components/chores/CelebrationBurst'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

interface ChoreRowProps {
  area: string
  title: string
  subtitle: string
  onComplete: () => void
  pending?: boolean
  className?: string
}

/**
 * Riga "Da fare" / "Gesti": nome, ultima volta, e un bottone "Fatto" che
 * registra in un tap. Nessuna conferma: non è un'azione distruttiva, e la
 * conferma comprometterebbe l'obiettivo dei 5 secondi (AGENTS.md).
 */
export function ChoreRow({
  area,
  title,
  subtitle,
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
      className={cn('flex w-full items-center gap-3 px-4 py-3', className)}
      animate={celebrating ? { backgroundColor: 'var(--positive-muted)' } : { backgroundColor: 'transparent' }}
      transition={{ duration: 0.5 }}
    >
      <ChoreIcon area={area} size="md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        <div className="mt-0.5 truncate text-xs text-muted">{subtitle}</div>
      </div>
      <div className="relative shrink-0">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleClick}
          disabled={pending}
          className={cn('transition-transform duration-300', celebrating && 'scale-110')}
        >
          {pending ? <Spinner size="sm" /> : 'Fatto'}
        </Button>
        <CelebrationBurst active={celebrating} onDone={() => setCelebrating(false)} emoji="✨" />
      </div>
    </motion.div>
  )
}
