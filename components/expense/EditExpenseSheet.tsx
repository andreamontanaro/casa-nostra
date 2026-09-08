'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { EditExpenseForm } from '@/app/(app)/spese/[id]/EditExpenseForm'
import type { Tables } from '@/types/database'

export function EditExpenseSheet({ expense, profiles, currentUserId, attachmentCount }: {
  expense: Tables<'expenses'>; profiles: Tables<'profiles'>[]; currentUserId: string; attachmentCount: number
}) {
  const [open, setOpen] = useState(false)
  if (expense.settlement_id) return <p className="px-5 py-4 text-sm text-muted">Questa spesa è saldata e resta nello storico in sola lettura.</p>
  return <div className="px-4 py-5">
    <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}><Pencil className="size-4" aria-hidden />Modifica spesa</Button>
    <Sheet open={open} onOpenChange={setOpen} title="Modifica spesa" size="full">
      <EditExpenseForm expense={expense} profiles={profiles} currentUserId={currentUserId} attachmentCount={attachmentCount} />
    </Sheet>
  </div>
}
