'use client'

import { useState } from 'react'
import { Repeat } from 'lucide-react'
import type { SubscriptionView } from '@/lib/subscriptions/service'
import { HOME_UPCOMING_DAYS, daysBetween, relativeDays } from '@/lib/subscriptions/schedule'
import { formatEur, splitLabel } from '@/lib/fmt'
import { revealDelay } from '@/lib/motion'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Card } from '@/components/ui/Card'
import { ListRow } from '@/components/ui/ListRow'
import { AnticipateChargeSheet } from '@/components/AnticipateChargeSheet'
import type { Tables } from '@/types/database'

type Profile = Tables<'profiles'>

/**
 * «Abbonamenti in arrivo» in home: gli addebiti dei prossimi
 * `HOME_UPCOMING_DAYS` giorni non ancora registrati. Non sono spese: non
 * pesano sul saldo finché il cron non le registra, il giorno dell'addebito.
 * Un tocco apre il foglio per anticipare l'addebito (`AnticipateChargeSheet`),
 * con un link alla schermata Abbonamenti.
 */
export function UpcomingSubscriptions({
  subscriptions,
  notifyHour,
  today,
  userId,
  profiles,
  step,
}: {
  subscriptions: SubscriptionView[]
  notifyHour: number
  today: string
  userId: string
  profiles: Profile[]
  step: number
}) {
  const [sheet, setSheet] = useState<{ open: boolean; sub: SubscriptionView | null; key: number }>({
    open: false,
    sub: null,
    key: 0,
  })
  const total = subscriptions.reduce((sum, s) => sum + Math.round(Number(s.amount) * 100), 0) / 100
  const nameOf = (id: string) => (id === userId ? 'Tu' : profiles.find((p) => p.id === id)?.display_name ?? '—')
  const otherOf = (id: string) => profiles.find((p) => p.id !== id)?.display_name

  return (
    <section aria-labelledby="home-subscriptions">
      <div className="mb-3 flex items-center justify-between gap-3 px-1 reveal-up" style={revealDelay(step)}>
        <h2 id="home-subscriptions" className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Repeat className="size-4 text-accent" aria-hidden />
          Abbonamenti in arrivo
        </h2>
        <span className="text-sm font-semibold tabular-nums text-muted">{formatEur(total)}</span>
      </div>
      <Card className="overflow-hidden p-0 reveal-up" style={revealDelay(step + 0.5)}>
        {subscriptions.map((sub) => {
          const days = daysBetween(today, sub.nextDue)
          return (
            <ListRow
              key={sub.id}
              onClick={() => setSheet((s) => ({ open: true, sub, key: s.key + 1 }))}
              leading={<CategoryIcon category={sub.category} size="md" />}
              title={sub.description}
              subtitle={`${nameOf(sub.paid_by)} · ${splitLabel(sub.split_rule, otherOf(sub.paid_by))}`}
              trailing={
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-sm font-semibold tabular-nums text-foreground">{formatEur(Number(sub.amount))}</span>
                  <span className="text-xs text-muted">
                    {days === 0 ? `oggi alle ${String(notifyHour).padStart(2, '0')}:00` : relativeDays(days)}
                  </span>
                </div>
              }
            />
          )
        })}
      </Card>
      <p className="mt-2 px-1 text-xs text-muted reveal-up" style={revealDelay(step + 0.5)}>
        Nei prossimi {HOME_UPCOMING_DAYS} giorni. Entrano nel saldo il giorno dell’addebito, o prima se lo anticipi.
      </p>
      <AnticipateChargeSheet
        key={sheet.key}
        open={sheet.open}
        subscription={sheet.sub}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        today={today}
        userId={userId}
        profiles={profiles}
        manageLink
      />
    </section>
  )
}
