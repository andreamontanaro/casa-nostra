'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { springSnappy } from '@/lib/motion'
import { Sheet } from '@/components/ui/Sheet'
import { ExpenseForm } from '@/app/(app)/spese/nuova/ExpenseForm'
import type { OptimisticExpense } from '@/app/(app)/spese/nuova/ExpenseForm'
import { cn } from '@/lib/utils'
import type { Tables } from '@/types/database'

type Profile = Tables<'profiles'>

interface NuovaSpesaFabProps {
  profiles: Profile[]
  currentUserId: string
  suggestions?: string[]
  // Se passato, l'inserimento avviene in modo ottimistico (Home). In assenza,
  // il form salva e la lista si aggiorna via revalidazione.
  onOptimisticInsert?: (e: OptimisticExpense) => void
  // Apertura controllata dal parent (per CTA esterne, es. empty state). Se
  // omessa, il componente gestisce lo stato internamente tramite il FAB.
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function NuovaSpesaFab({
  profiles,
  currentUserId,
  suggestions = [],
  onOptimisticInsert,
  open: openProp,
  onOpenChange,
}: NuovaSpesaFabProps) {
  const [openState, setOpenState] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : openState
  const setOpen = (o: boolean) => {
    if (!isControlled) setOpenState(o)
    onOpenChange?.(o)
  }

  return (
    <>
      {/* FAB → Sheet */}
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Nuova spesa"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...springSnappy, delay: 0.1 }}
        whileTap={{ scale: 0.92 }}
        className={cn(
          'fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 hide-on-keyboard',
          'flex size-14 items-center justify-center rounded-full',
          'bg-accent text-accent-foreground shadow-fab',
        )}
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </motion.button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        size="full"
        title="Nuova spesa"
      >
        <ExpenseForm
          profiles={profiles}
          currentUserId={currentUserId}
          suggestions={suggestions}
          onOptimisticInsert={onOptimisticInsert}
          onSuccess={() => setOpen(false)}
        />
      </Sheet>
    </>
  )
}
