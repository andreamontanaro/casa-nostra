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
  className?: string
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: SheetProps) {
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
            'fixed inset-x-0 bottom-0 z-50 max-h-[92svh] overflow-y-auto',
            'rounded-t-[28px] border-t border-border/60 bg-surface shadow-dialog',
            'pb-[env(safe-area-inset-bottom)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
            'duration-300',
            className,
          )}
        >
          {/* Drag handle */}
          <div className="sticky top-0 z-10 flex justify-center bg-surface pt-3 pb-1">
            <div className="h-1.5 w-12 rounded-full bg-border-strong" />
          </div>

          {(title || description) && (
            <div className="px-5 pt-2 pb-1">
              {title && (
                <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
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

          <div className="px-1 pb-2">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
