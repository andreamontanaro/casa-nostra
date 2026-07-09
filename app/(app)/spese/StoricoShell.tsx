'use client'

import { useState } from 'react'
import { SpeseFiltri } from './SpeseFiltri'
import { NuovaSpesaFab } from '@/components/NuovaSpesaFab'
import type { Tables } from '@/types/database'

type Expense = Tables<'expenses'> & {
  paid_by_profile: { display_name: string } | null
}
type Profile = Tables<'profiles'>

interface StoricoShellProps {
  expenses: Expense[]
  profiles: Profile[]
  currentUserId: string
  suggestions: string[]
}

export function StoricoShell({
  expenses,
  profiles,
  currentUserId,
  suggestions,
}: StoricoShellProps) {
  // Stato del sheet condiviso tra il FAB e la CTA dell'empty state.
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <SpeseFiltri expenses={expenses} onAddExpense={() => setSheetOpen(true)} />
      <NuovaSpesaFab
        profiles={profiles}
        currentUserId={currentUserId}
        suggestions={suggestions}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  )
}
