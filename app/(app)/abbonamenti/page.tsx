import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfiles } from '@/lib/queries'
import { todayISO } from '@/lib/fmt'
import { isTelegramConfigured } from '@/lib/telegram/config'
import { getSubscriptionsOverview, type SubscriptionsOverview } from '@/lib/subscriptions/service'
import { HeaderActions } from '@/components/HeaderActions'
import { AbbonamentiShell } from './AbbonamentiShell'

export default async function AbbonamentiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = todayISO()
  let overview: SubscriptionsOverview | null = null
  try {
    overview = await getSubscriptionsOverview(supabase, today)
  } catch (error) {
    // Di solito: codice pubblicato prima della migrazione.
    console.error('[abbonamenti] lettura non riuscita:', error)
  }
  const profiles = await getProfiles(supabase)

  if (!overview) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-24 lg:pb-8">
        <header className="flex items-center gap-3">
          <h1 className="min-w-0 flex-1 font-display text-3xl font-semibold tracking-tight">Abbonamenti</h1>
          <HeaderActions />
        </header>
        <p role="alert" className="rounded-3xl bg-surface p-4 text-sm text-muted">
          Non riesco a leggere gli abbonamenti. Se la funzione è appena arrivata, va eseguita la migrazione{' '}
          <code className="rounded bg-surface-sunken px-1 py-0.5">2026-11-05_abbonamenti.sql</code> su Supabase.
        </p>
      </div>
    )
  }

  return (
    <AbbonamentiShell
      subscriptions={overview.subscriptions}
      notifyHour={overview.notifyHour}
      profiles={profiles}
      currentUserId={user.id}
      today={today}
      telegramConfigured={isTelegramConfigured()}
    />
  )
}
