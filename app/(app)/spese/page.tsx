import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getAllExpenses } from '@/lib/queries'
import { SpeseFiltri } from './SpeseFiltri'

export default async function SpesePage() {
  const expenses = await getAllExpenses()

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <h1 className="text-xl font-semibold text-foreground">Storico spese</h1>

      <SpeseFiltri expenses={expenses} />

      <Link
        href="/spese/nuova"
        aria-label="Nuova spesa"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg active:opacity-80 transition-opacity"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </Link>
    </div>
  )
}
