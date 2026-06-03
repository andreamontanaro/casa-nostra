'use client'

import { useEffect, useState } from 'react'
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

const TYPED_PHRASES = [
  'Le spese di casa',
  'L’affitto di casa',
  'Le bollette di casa',
]

/**
 * Titolo dinamico in stile "macchina da scrivere": scrive una frase, fa una
 * pausa, la cancella e passa alla successiva, ciclando all’infinito.
 * Renderizza la prima frase per intero lato server (utile per SEO e per
 * evitare un titolo vuoto al primo paint) e rispetta prefers-reduced-motion.
 */
export function Typewriter() {
  const [index, setIndex] = useState(0)
  const [count, setCount] = useState(TYPED_PHRASES[0].length)
  const [deleting, setDeleting] = useState(false)
  const [animate, setAnimate] = useState(false)

  // Attiva l'animazione solo dopo il mount e se l'utente non ha chiesto
  // riduzione del movimento.
  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnimate(true)
    }
  }, [])

  useEffect(() => {
    if (!animate) return
    const current = TYPED_PHRASES[index]

    if (!deleting && count === current.length) {
      const t = setTimeout(() => setDeleting(true), 1700)
      return () => clearTimeout(t)
    }
    if (deleting && count === 0) {
      setDeleting(false)
      setIndex((i) => (i + 1) % TYPED_PHRASES.length)
      return
    }
    const t = setTimeout(
      () => setCount((c) => c + (deleting ? -1 : 1)),
      deleting ? 45 : 85,
    )
    return () => clearTimeout(t)
  }, [animate, count, deleting, index])

  const text = TYPED_PHRASES[index].slice(0, count)

  return (
    <span aria-label={TYPED_PHRASES[0]}>
      <span aria-hidden>{text}</span>
      <span
        aria-hidden
        className="ml-1 inline-block h-[0.85em] w-[3px] translate-y-[2px] rounded-full bg-accent align-baseline animate-pulse"
      />
    </span>
  )
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
