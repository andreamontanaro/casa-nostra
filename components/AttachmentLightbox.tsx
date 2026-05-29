'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AttachmentLightboxProps {
  url: string | null
  fileName?: string
  onClose: () => void
}

export function AttachmentLightbox({ url, fileName, onClose }: AttachmentLightboxProps) {
  return (
    <DialogPrimitive.Root
      open={!!url}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center p-4',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
            'duration-200 focus:outline-none',
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {fileName ?? 'Anteprima allegato'}
          </DialogPrimitive.Title>
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={fileName ?? ''}
              className="max-h-[90vh] max-w-full rounded-2xl object-contain shadow-dialog"
            />
          )}
          <DialogPrimitive.Close
            aria-label="Chiudi"
            className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
