'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  // schermo intero (form amount-first).
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
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex flex-col',
            'rounded-t-[28px] border-t border-border/60 bg-surface shadow-dialog',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
            'duration-300',
            isFull ? 'top-3 h-[calc(100svh-0.75rem)]' : 'max-h-[92svh]',
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
              !footer && 'pb-[env(safe-area-inset-bottom)]',
            )}
          >
            {children}
          </div>

          {/* Footer sticky opzionale */}
          {footer && (
            <div className="shrink-0 border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
