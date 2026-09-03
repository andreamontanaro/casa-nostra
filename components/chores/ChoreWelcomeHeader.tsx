'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { greetingForHour } from '@/lib/fmt'
import { springSoft } from '@/lib/motion'

const SUBTITLES = [
  'Ci pensate insieme, un tap alla volta.',
  'Ogni faccenda registrata conta per la casa.',
  'Cosa farai oggi?',
  'Nessun punteggio da difendere: solo cose fatte.',
]

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

interface ChoreWelcomeHeaderProps {
  displayName: string
}

/**
 * Header caloroso in cima a `/casa`: un saluto, non un cruscotto. La
 * sottotitolo ruota fra frasi che ribadiscono il tono del modulo (mai un
 * confronto, mai un turno da rispettare) invece di essere sempre la stessa.
 * Scelta deterministica sul giorno dell'anno: niente stato, niente effect,
 * stabile per tutta la sessione ma diversa da un giorno all'altro.
 */
export function ChoreWelcomeHeader({ displayName }: ChoreWelcomeHeaderProps) {
  // Calcolo su componenti UTC: server e client vedono lo stesso "oggi" a
  // prescindere dal fuso, niente mismatch di idratazione da gestire qui
  // (a differenza del saluto sotto, che dipende apposta dall'ora locale).
  const [dayOfYear] = useState(() => {
    const now = new Date()
    const start = Date.UTC(now.getUTCFullYear(), 0, 0)
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    return Math.floor((today - start) / 86400000)
  })
  const subtitle = SUBTITLES[dayOfYear % SUBTITLES.length]
  const greeting = greetingForHour(new Date().getHours())

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...springSoft, bounce: 0.4 }}
      className="px-1 pt-1"
    >
      {/* Il saluto dipende dall'ora locale: server (UTC) e client (Europe/Rome)
          possono calcolarla in modo diverso vicino ai confini fascia oraria.
          suppressHydrationWarning è l'escape hatch corretto per un testo che
          si accetta possa differire fra le due renderizzazioni. */}
      <h1
        className="text-2xl font-black tracking-[-0.01em] text-foreground"
        suppressHydrationWarning
      >
        {greeting}, {firstName(displayName)}{' '}
        <motion.span
          className="inline-block"
          animate={{ rotate: [0, 18, -12, 18, -4, 0] }}
          transition={{ duration: 1.4, delay: 0.3, ease: 'easeInOut' }}
        >
          👋
        </motion.span>
      </h1>
      <p className="mt-0.5 text-sm font-medium text-muted">{subtitle}</p>
    </motion.div>
  )
}
