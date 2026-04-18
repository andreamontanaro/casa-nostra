'use client'

import { useEffect, useRef } from 'react'
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
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open) dialog.showModal()
    else dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="w-full max-w-sm rounded-2xl border border-border p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-2 text-sm text-muted">{description}</p>
        )}
        {children && <div className="mt-4">{children}</div>}
      </div>
      <div className="flex gap-3 border-t border-border px-6 py-4">
        <Button variant="secondary" size="md" className="flex-1" onClick={onClose} disabled={loading}>
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
    </dialog>
  )
}
