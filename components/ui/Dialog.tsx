'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  confirmLabel?: string
  confirmVariant?: 'primary' | 'destructive'
  onConfirm?: () => void
  loading?: boolean
  children?: React.ReactNode
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Conferma',
  confirmVariant = 'primary',
  onConfirm,
  loading = false,
  children,
}: DialogProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          )}
        />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => {
            if (loading) e.preventDefault()
          }}
          onPointerDownOutside={(e) => {
            if (loading) e.preventDefault()
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2',
            'rounded-[28px] border border-border/60 bg-surface shadow-dialog',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
            'duration-200',
          )}
        >
          <div className="p-6">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-2 text-sm text-muted">
                {description}
              </DialogPrimitive.Description>
            )}
            {children && <div className="mt-4">{children}</div>}
          </div>
          <div className="flex gap-3 border-t border-border px-6 py-4">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              Annulla
            </Button>
            {onConfirm && (
              <Button
                variant={confirmVariant}
                size="md"
                className="flex-1"
                onClick={onConfirm}
                loading={loading}
              >
                {confirmLabel}
              </Button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
