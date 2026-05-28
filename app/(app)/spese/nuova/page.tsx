import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  getProfiles,
  getCurrentUser,
  getFrequentDescriptions,
} from '@/lib/queries'
import { ExpenseForm } from './ExpenseForm'

export default async function NuovaSpesaPage() {
  const [user, profiles, suggestions] = await Promise.all([
    getCurrentUser(),
    getProfiles(),
    getFrequentDescriptions(5),
  ])

  if (!user) return null

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-3 px-4 pt-6 pb-2">
        <Link
          href="/"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-raised transition-colors text-muted"
          aria-label="Torna indietro"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Nuova spesa</h1>
      </header>

      <ExpenseForm
        profiles={profiles}
        currentUserId={user.id}
        suggestions={suggestions}
      />
    </div>
  )
}
