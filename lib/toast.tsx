'use client'

import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner'

export const toast = sonnerToast

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      richColors
      closeButton
      offset={16}
      duration={3500}
      toastOptions={{
        classNames: {
          toast:
            'rounded-2xl border border-border bg-surface text-foreground shadow-card backdrop-blur',
          title: 'text-sm font-medium',
          description: 'text-xs text-muted',
          actionButton: 'rounded-lg',
          cancelButton: 'rounded-lg',
        },
      }}
    />
  )
}
