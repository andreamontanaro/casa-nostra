'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { buttonVariants } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface RevealProps {
  children: React.ReactNode
  className?: string
  /** Ritardo in secondi per scalare l'entrata di elementi adiacenti. */
  delay?: number
  /** Tag HTML da rendere (default: section). */
  as?: 'section' | 'div' | 'li'
}

/**
 * Wrapper leggero che anima l'ingresso di una sezione quando entra nel viewport.
 * Coerente con lo spring usato in BalanceCard/HomeShell. Rispetta
 * prefers-reduced-motion via la configurazione globale di Motion.
 */
export function Reveal({ children, className, delay = 0, as = 'section' }: RevealProps) {
  const MotionTag = motion[as]
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ type: 'spring', stiffness: 220, damping: 26, delay }}
    >
      {children}
    </MotionTag>
  )
}


/** Titolo stabile: leggibile al primo paint e senza movimento continuo. */
export function Typewriter() {
  return <span className="font-display">Le spese di casa</span>
}

interface CtaLinkProps {
  href: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children: React.ReactNode
}

/**
 * Link stilizzato come Button. Vive in un file client perché `buttonVariants`
 * proviene da un componente 'use client' e non è invocabile lato server.
 */
export function CtaLink({ href, size = 'md', className, children }: CtaLinkProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ size }), className)}>
      {children}
    </Link>
  )
}
