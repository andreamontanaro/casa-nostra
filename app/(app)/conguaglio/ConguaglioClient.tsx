'use client'

import { useState, useTransition } from 'react'
import { registerSettlement } from '@/app/actions/settlement'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { toast } from '@/lib/toast'

interface ConguaglioClientProps {
  hasBalance: boolean
}

export function ConguaglioClient({ hasBalance }: ConguaglioClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      try {
        await registerSettlement()
      } catch (e) {
        toast.error('Errore durante il conguaglio. Riprova.')
        setDialogOpen(false)
      }
    })
  }

  return (
    <>
      <div className="flex flex-col gap-3 px-4">
        <Button
          size="lg"
          className="w-full"
          disabled={!hasBalance}
          onClick={() => setDialogOpen(true)}
        >
          Registra conguaglio
        </Button>
        {!hasBalance && (
          <p className="text-center text-sm text-muted">
            Il saldo è zero, niente da conguagliare.
          </p>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Conferma conguaglio"
        description="Tutte le spese aperte verranno marcate come saldate. Assicurati che il bonifico sia già avvenuto."
        confirmLabel="Conferma"
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  )
}
