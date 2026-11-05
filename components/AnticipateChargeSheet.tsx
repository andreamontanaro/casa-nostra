'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { SubscriptionView } from '@/lib/subscriptions/service'
import { anticipateSubscriptionAction } from '@/app/actions/subscriptions'
import { daysBetween, relativeDays } from '@/lib/subscriptions/schedule'
import { formatDateShort, formatEur, formatWeekdayDate, splitLabel } from '@/lib/fmt'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import type { Tables } from '@/types/database'

type Profile = Tables<'profiles'>

/**
 * Anticipa il prossimo addebito di un abbonamento in arrivo: la spesa entra
 * subito nel saldo e quell'addebito risulta fatto (il cron non lo ricrea, il
 * promemoria non parte). La data della spesa la sceglie chi anticipa, ogni
 * volta: oggi o il giorno dell'addebito. Niente è preselezionato, tranne
 * quando le due date coincidono.
 */
export function AnticipateChargeSheet({
  subscription,
  open,
  onClose,
  today,
  userId,
  profiles,
  manageLink = false,
}: {
  subscription: SubscriptionView | null
  open: boolean
  onClose: () => void
  today: string
  userId: string
  profiles: Profile[]
  /** In home: un link alla schermata Abbonamenti sotto il bottone. */
  manageLink?: boolean
}) {
  const sub = subscription
  const sameDay = sub?.nextDue === today
  const [expenseDate, setExpenseDate] = useState<string | null>(sameDay ? today : null)
  const [pending, startTransition] = useTransition()

  if (!sub) return null
  const days = daysBetween(today, sub.nextDue)
  const payer = sub.paid_by === userId ? 'te' : profiles.find((p) => p.id === sub.paid_by)?.display_name ?? '—'
  const chargedTo = profiles.find((p) => p.id !== sub.paid_by)?.display_name
  const options = sameDay
    ? [{ value: today, label: `Oggi, ${formatDateShort(today)}`, hint: 'il giorno dell’addebito' }]
    : [
        { value: today, label: `Oggi, ${formatDateShort(today)}`, hint: 'come se fosse già addebitato' },
        { value: sub.nextDue, label: formatDateShort(sub.nextDue), hint: 'il giorno dell’addebito' },
      ]

  function confirm() {
    if (!sub || !expenseDate) return
    startTransition(async () => {
      const result = await anticipateSubscriptionAction(sub.id, sub.nextDue, expenseDate)
      if (result.error) return void toast.error(result.error)
      toast.success('Addebito anticipato', {
        description: `${sub.description}: ${formatEur(Number(sub.amount))} registrati il ${formatDateShort(expenseDate)}.`,
      })
      onClose()
    })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && !pending && onClose()}
      title="Anticipa l’addebito"
      footer={
        <div className="flex flex-col gap-2">
          <Button onClick={confirm} loading={pending} disabled={!expenseDate} size="lg" className="w-full">
            {expenseDate ? `Registra ${formatEur(Number(sub.amount))}` : 'Scegli la data'}
          </Button>
          {manageLink && (
            <Link href="/abbonamenti" className="flex min-h-11 items-center justify-center text-sm font-semibold text-accent">
              Gestisci gli abbonamenti
            </Link>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5 px-4 pb-6">
        <div className="flex items-center gap-3 rounded-2xl bg-surface-raised p-4">
          <CategoryIcon category={sub.category} />
          <div className="min-w-0 flex-1">
            <p className="break-words font-semibold">{sub.description}</p>
            <p className="mt-0.5 text-xs text-muted">
              {splitLabel(sub.split_rule, chargedTo)} · addebito su {payer}
            </p>
          </div>
          <p className="shrink-0 font-display text-xl font-semibold tabular-nums">{formatEur(Number(sub.amount))}</p>
        </div>

        <p className="text-sm text-muted">
          L’addebito è previsto {relativeDays(days)}, {formatWeekdayDate(sub.nextDue)}. Anticipandolo, la spesa entra
          subito nel saldo e quel giorno non viene registrata di nuovo, né arriva il promemoria.
        </p>

        <div className="flex flex-col gap-2">
          <span className="text-label font-medium text-muted">Con che data registro la spesa?</span>
          <div className="flex gap-2">
            {options.map((option) => {
              const active = expenseDate === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setExpenseDate(option.value)}
                  disabled={pending}
                  aria-pressed={active}
                  className={cn(
                    'flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-2.5 text-center',
                    'transition-[border-color,background-color,color,transform] duration-150 active:scale-[0.97] disabled:opacity-50',
                    active ? 'border-accent bg-accent-muted text-accent-soft' : 'border-border bg-surface text-foreground hover:border-accent/40',
                  )}
                >
                  <span className="text-sm font-semibold">{option.label}</span>
                  <span className={cn('text-xs', active ? 'text-accent-soft' : 'text-muted')}>{option.hint}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Sheet>
  )
}
