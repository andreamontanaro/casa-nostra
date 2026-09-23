'use client'

import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { springSnappy } from '@/lib/motion'
import { Sheet } from '@/components/ui/Sheet'
import { ExpenseForm } from '@/app/(app)/spese/nuova/ExpenseForm'
import { cn } from '@/lib/utils'
import type { Tables } from '@/types/database'
import type { ExpenseSuggestion } from '@/lib/queries'

type Profile = Tables<'profiles'>

interface NuovaSpesaFabProps {
  profiles: Profile[]
  currentUserId: string
  suggestions?: ExpenseSuggestion[]
  // Apertura controllata dal parent (per CTA esterne, es. empty state). Se
  // omessa, il componente gestisce lo stato internamente tramite il FAB.
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function NuovaSpesaFab({
  profiles,
  currentUserId,
  suggestions = [],
  open: openProp,
  onOpenChange,
}: NuovaSpesaFabProps) {
  const saving = useRef(false)
  const [openState, setOpenState] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : openState
  const setOpen = (o: boolean) => {
    if (!o && saving.current) return
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
          'fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] app-fab z-30 hide-on-keyboard',
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
          onPendingChange={(pending) => { saving.current = pending }}
          onSuccess={() => { saving.current = false; setOpen(false) }}
        />
      </Sheet>
    </>
  )
}
