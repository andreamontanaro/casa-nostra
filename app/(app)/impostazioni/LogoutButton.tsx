'use client'

import { useState, useTransition } from 'react'
import { LogOut } from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

export function LogoutButton() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      await logout()
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="md"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <LogOut className="size-4" />
        Esci
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Confermi il logout?"
        description="Dovrai inserire di nuovo email e password per rientrare."
        confirmLabel="Esci"
        confirmVariant="destructive"
        onConfirm={handleConfirm}
        loading={pending}
      />
    </>
  )
}
