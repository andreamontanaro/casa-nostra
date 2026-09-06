'use client'

import { useEffect, useRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Quanto aspettare prima di mettere a fuoco il primo campo, in millisecondi:
 * la durata dell'animazione di entrata (`duration-300`) più un margine.
 *
 * Il fuoco iniziale non può arrivare al montaggio (né con `autoFocus` sul campo
 * né lasciandolo fare a Radix): la sheet in quel momento sta ancora scivolando
 * su dal fondo, e iOS, per "scoprire" un campo che sta fuori schermo, spinge su
 * l'intera finestra — è il «premo + e vola su tutto». A fine animazione il
 * campo è dove deve stare e la tastiera si comporta.
 */
const OPEN_FOCUS_DELAY = 340

/** Il campo da mettere a fuoco all'apertura si marca con `data-autofocus`. */
const AUTOFOCUS_SELECTOR = '[data-autofocus]'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  children: React.ReactNode
  // Barra azioni sticky in fondo (sopra la safe-area): resta visibile
  // mentre il corpo scrolla, anche con tastiera aperta.
  footer?: React.ReactNode
  // `auto` = altezza guidata dal contenuto (bottom-sheet); `full` = quasi
  // schermo intero (form amount-first). In entrambi i casi l'altezza si
  // accorcia da sola quando compare la tastiera.
  size?: 'auto' | 'full'
  className?: string
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'auto',
  className,
}: SheetProps) {
  const isFull = size === 'full'
  const contentRef = useRef<HTMLDivElement>(null)
  const focusTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(focusTimer.current), [])

  function handleOpenAutoFocus(event: Event) {
    // Il fuoco entra subito nella sheet — serve a lettori di schermo e al giro
    // di Tab — ma sul contenitore, che non apre nessuna tastiera. Il campo vero
    // lo mettiamo a fuoco quando la sheet ha finito di salire.
    event.preventDefault()
    contentRef.current?.focus({ preventScroll: true })

    window.clearTimeout(focusTimer.current)
    focusTimer.current = window.setTimeout(() => {
      const field = contentRef.current?.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR)
      field?.focus({ preventScroll: true })
    }, OPEN_FOCUS_DELAY)
  }

  function handleCloseAutoFocus() {
    window.clearTimeout(focusTimer.current)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          )}
        />
        <DialogPrimitive.Content
          ref={contentRef}
          onOpenAutoFocus={handleOpenAutoFocus}
          onCloseAutoFocus={handleCloseAutoFocus}
          className={cn(
            // Sopra la tastiera invece che sotto: `bottom` la scavalca e
            // l'altezza si accorcia dello spazio che ruba. Sono due misure
            // diverse — vedi lib/keyboard.ts — perché quando iOS spinge su la
            // pagina da sé il fondo è già a posto ma l'altezza no, e la testa
            // della sheet (intestazione e primi campi) finirebbe fuori schermo.
            'fixed inset-x-0 bottom-[var(--keyboard-inset)] z-50 flex flex-col',
            'rounded-t-[28px] border-t border-border/60 bg-surface shadow-dialog',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
            'duration-300',
            isFull
              ? 'h-[calc(100svh-0.75rem-var(--keyboard-height))]'
              : 'max-h-[calc(92svh-var(--keyboard-height))]',
            className,
          )}
        >
          {/* Header sticky: drag handle + titolo + chiudi */}
          <div className="relative shrink-0 rounded-t-[28px] bg-surface">
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-border-strong" />
            </div>

            {(title || description) && (
              <div className="px-5 pt-1 pb-3">
                {title && (
                  <DialogPrimitive.Title className="text-title font-semibold text-foreground">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="mt-1 text-sm text-muted">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
            )}

            <DialogPrimitive.Close
              aria-label="Chiudi"
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-raised hover:text-foreground active:scale-95 transition-[background-color,transform]"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>

          {/* Corpo scrollabile */}
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto px-1',
              !footer && 'pb-[var(--safe-bottom)]',
            )}
          >
            {children}
          </div>

          {/* Footer sticky opzionale */}
          {footer && (
            <div className="shrink-0 border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,var(--safe-bottom))]">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
