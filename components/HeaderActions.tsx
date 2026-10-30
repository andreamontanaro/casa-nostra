'use client'

import { Suspense, createContext, use } from 'react'
import { Menu, Sparkles } from 'lucide-react'
import { openAppMenu } from '@/lib/app-menu'
import { openAssistant } from '@/lib/assistant/ui'
import { cn } from '@/lib/utils'

/**
 * Il nome di chi guarda, per l'iniziale sul bottone del menu. Il layout lo
 * passa come promise senza aspettarlo: la pagina non attende una query in
 * più, e finché il nome non arriva il cerchio mostra l'icona del menu.
 */
const DisplayNameContext = createContext<Promise<string | null> | null>(null)

export function DisplayNameProvider({ name, children }: { name: Promise<string | null>; children: React.ReactNode }) {
  return <DisplayNameContext value={name}>{children}</DisplayNameContext>
}

const CIRCLE_CLASS = 'flex size-11 shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-150 active:scale-95'

/**
 * I due bottoni a destra del titolo di ogni pagina, al posto della top bar:
 * l'assistente e il cerchio con l'iniziale, che apre il menu con tutte le
 * schermate (`AppMenu`). Su desktop il menu non serve, c'è la navigazione
 * laterale. Scorrono via con la pagina.
 */
export function HeaderActions({ className }: { className?: string }) {
  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      <button type="button" onClick={() => openAssistant()} aria-label="Apri l’assistente"
        className={cn(CIRCLE_CLASS, 'bg-accent-muted text-accent-soft sm:w-auto sm:gap-2 sm:px-4 sm:text-sm sm:font-semibold')}>
        <Sparkles className="size-5 sm:size-4" aria-hidden /><span className="hidden sm:inline">Assistente</span>
      </button>
      <button type="button" onClick={openAppMenu} aria-label="Apri il menu"
        className={cn(CIRCLE_CLASS, 'bg-surface-raised text-foreground hover:bg-surface-sunken lg:hidden')}>
        <Suspense fallback={<Menu className="size-5" aria-hidden />}><Initial /></Suspense>
      </button>
    </div>
  )
}

function Initial() {
  const promise = use(DisplayNameContext)
  const name = promise ? use(promise) : null
  const initial = name?.trim().charAt(0).toUpperCase()
  if (!initial) return <Menu className="size-5" aria-hidden />
  return <span aria-hidden className="font-display text-lg font-semibold leading-none">{initial}</span>
}
