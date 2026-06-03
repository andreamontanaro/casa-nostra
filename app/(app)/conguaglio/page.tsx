import {
  getCurrentUser,
  getOpenExpensesWithContribution,
  getProfiles,
} from '@/lib/queries'
import { ConguaglioClient } from './ConguaglioClient'

export default async function ConguaglioPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const [profiles, expenses] = await Promise.all([
    getProfiles(),
    getOpenExpensesWithContribution(user.id),
  ])

  const other = profiles.find((p) => p.id !== user.id)
  const otherUserName = other?.display_name ?? 'Altro'

  return (
    <div className="flex flex-col px-4 pb-6">
      <div className="relative isolate -mx-4 flex flex-col gap-5 overflow-visible px-4 pt-6 pb-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--accent-muted)_28%,var(--background))_0%,color-mix(in_oklab,var(--surface)_64%,var(--background))_56%,var(--background)_100%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-b from-transparent to-background"
        />

        <h1 className="text-xl font-semibold text-foreground">Conguaglio</h1>
        <ConguaglioClient expenses={expenses} otherUserName={otherUserName} />
      </div>
    </div>
  )
}
