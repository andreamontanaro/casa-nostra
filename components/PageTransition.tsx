'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { usePathname } from 'next/navigation'

/**
 * Entrata leggera della pagina a ogni cambio di rotta. Solo entrata: niente
 * uscita e niente `AnimatePresence mode="wait"`, che faceva aspettare a ogni
 * navigazione la fine dell'uscita della pagina vecchia — e nell'App Router il
 * contenitore in uscita mostra già la pagina nuova (i `children` di un layout
 * leggono la rotta corrente), quindi si vedeva la pagina nuova sparire e
 * ricomparire.
 *
 * Al primo caricamento niente animazione: un `initial` con `opacity: 0`
 * finirebbe nell'HTML del server e la pagina resterebbe invisibile fino
 * all'idratazione. Si anima solo dalla prima navigazione in poi.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [firstPath, setFirstPath] = useState<string | null>(pathname)
  if (firstPath !== null && pathname !== firstPath) setFirstPath(null)

  return (
    <motion.div
      key={pathname}
      initial={firstPath === null ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
