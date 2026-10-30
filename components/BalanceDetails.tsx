'use client'

import Link from 'next/link'
import { Check, Lightbulb, Sparkles } from 'lucide-react'
import { SpendingRing } from '@/components/SpendingRing'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CATEGORY_LABELS, formatEur } from '@/lib/fmt'
import { categoryTotals } from '@/lib/spending'
import { openAssistant } from '@/lib/assistant/ui'
import type { OpenExpenseWithContribution } from '@/lib/queries'
import type { Tables } from '@/types/database'

interface Props {
  rows: Tables<'v_user_open_balance'>[]
  currentUserId: string
  expenses: OpenExpenseWithContribution[]
}

/**
 * Schermata «Dettagli del saldo» (`/saldo`), aperta dalle azioni rapide della
 * home: anello grande, chi ha anticipato cosa, quali categorie pesano sul
 * saldo e il suggerimento su chi paga la prossima. Tutto letto da
 * `v_user_open_balance` e dalle quote già calcolate, nessun ricalcolo.
 */
export function BalanceDetails({ rows, currentUserId, expenses }: Props) {
  const me = rows.find((r) => r.user_id === currentUserId)
  const other = rows.find((r) => r.user_id !== currentUserId)
  if (!me || !other) return (
    <Card className="p-6"><h2 className="font-semibold">Saldo non disponibile</h2>
      <p className="mt-2 text-sm text-muted">Il saldo comparirà quando entrambi i profili saranno configurati.</p></Card>
  )
  const net = me.net_position ?? 0
  const categories = categoryTotals(expenses)
  const otherName = other.display_name?.split(' ')[0] ?? 'il partner'
  const maxContribution = Math.max(1, ...categories.map((c) => Math.abs(c.contribution)))

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1fr_1.15fr]">
      <Card className="p-5">
        <SpendingRing categories={categories} categoryHref={(category) => `/spese?stato=aperte&cat=${category}`}>
          {net === 0 ? (
            <><Check className="size-6 text-accent" aria-hidden /><p className="mt-2 font-display text-2xl font-semibold">Siete in pari</p>
              {expenses.length > 0 && <p className="mt-2 text-xs text-muted">Le spese si compensano</p>}</>
          ) : (
            <><p className="text-sm text-muted">{net > 0 ? 'Devi ricevere' : 'Devi dare'}</p>
              <AmountDisplay value={Math.abs(net)} className={`mt-2 whitespace-nowrap ${Math.abs(net) >= 10000 ? 'text-[1.8rem]' : 'text-[2.5rem]'}`} />
              <p className="mt-2 break-words text-sm">{net > 0 ? 'da' : 'a'} {otherName}</p></>
          )}
        </SpendingRing>
        <p className="mt-4 text-center text-xs text-muted">{expenses.length} {expenses.length === 1 ? 'spesa aperta' : 'spese aperte'}</p>
        {net !== 0 && (
          // «Chi paga la prossima»: chi deve soldi può rientrare pagando le
          // spese seguenti invece di fare un bonifico. Legge solo il segno di
          // `net_position`, non ricalcola niente.
          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-surface-raised p-3 text-xs leading-relaxed text-muted">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            <span>{net < 0 ? 'Se le prossime spese le paghi tu' : `Se le prossime spese le paga ${otherName}`}, il saldo si riequilibra senza bisogno di un bonifico.</span>
          </p>
        )}
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        <section aria-labelledby="saldo-persone">
          <h2 id="saldo-persone" className="mb-3 px-1 text-base font-semibold">Chi ha anticipato</h2>
          <Card className="divide-y divide-border overflow-hidden text-sm">
            {[me, other].map((person) => <div key={person.user_id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={person.display_name} /><div className="min-w-0 flex-1"><p className="font-semibold">{person.user_id === currentUserId ? 'Tu' : person.display_name}</p><p className="text-xs text-muted">Quota: {formatEur(person.total_owed ?? 0)}</p></div>
              <div className="text-right"><p className="font-semibold tabular-nums">{formatEur(person.total_anticipated ?? 0)}</p><p className="text-xs text-muted">anticipati</p></div>
            </div>)}
          </Card>
        </section>

        <section aria-labelledby="saldo-categorie">
          <h2 id="saldo-categorie" className="mb-3 px-1 text-base font-semibold">Categorie</h2>
          {categories.length === 0 ? (
            <Card><p className="px-4 py-8 text-center text-sm text-muted">Nessuna spesa aperta.</p></Card>
          ) : (
            <Card className="divide-y divide-border overflow-hidden text-sm">
              {categories.map((item) => (
                <div key={item.category} className="px-4 py-3">
                  <div className="flex justify-between gap-3"><Link className="text-accent underline underline-offset-4" href={`/spese?stato=aperte&cat=${item.category}`}>{CATEGORY_LABELS[item.category]}</Link><span className="font-semibold tabular-nums">{item.contribution > 0 ? '+' : ''}{formatEur(item.contribution)}</span></div>
                  <p className="mt-1 text-xs text-muted">{formatEur(item.total)} di spese · {item.contribution > 0 ? 'A tuo favore' : item.contribution < 0 ? 'A favore del partner' : 'Si compensa'}</p>
                  <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface-sunken"><span className={item.contribution >= 0 ? 'bg-accent' : 'bg-muted'} style={{ width: `${Math.max(2, Math.abs(item.contribution) / maxContribution * 100)}%` }} /></div>
                </div>
              ))}
            </Card>
          )}
        </section>

        <Button variant="secondary" size="sm" className="w-full" onClick={() => openAssistant('Spiegami come si forma il saldo corrente e quali categorie incidono di più.')}><Sparkles className="size-4" aria-hidden />Chiedi all’assistente</Button>
      </div>
    </div>
  )
}
