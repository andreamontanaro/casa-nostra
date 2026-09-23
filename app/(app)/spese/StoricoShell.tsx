'use client'

import { useState } from 'react'
import { SpeseFiltri } from './SpeseFiltri'
import { NuovaSpesaFab } from '@/components/NuovaSpesaFab'
import type { Tables } from '@/types/database'
import type { ExpenseSuggestion, SettlementWithNames } from '@/lib/queries'

type Expense = Tables<'expenses'> & {
  paid_by_profile: { display_name: string } | null
}
type Profile = Tables<'profiles'>

interface StoricoShellProps {
  expenses: Expense[]
  settlements: SettlementWithNames[]
  /** Effetto sul saldo di chi guarda, per id delle spese aperte. */
  contributions: Record<string, number>
  profiles: Profile[]
  currentUserId: string
  suggestions: ExpenseSuggestion[]
}

export function StoricoShell({
  expenses,
  settlements,
  contributions,
  profiles,
  currentUserId,
  suggestions,
}: StoricoShellProps) {
  // Stato del sheet condiviso tra il FAB e la CTA dell'empty state.
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <SpeseFiltri expenses={expenses} settlements={settlements} contributions={contributions} onAddExpense={() => setSheetOpen(true)} />
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
