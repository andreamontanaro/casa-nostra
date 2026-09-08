'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowRight, Bell, Check, ArrowLeft } from 'lucide-react'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { registerSettlement } from '@/app/actions/settlement'
import { requestSettlementOnTelegram } from '@/app/actions/telegram'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Sheet } from '@/components/ui/Sheet'
import { CategoryIcon } from '@/components/CategoryIcon'
import { SpendingRing } from '@/components/SpendingRing'
import { toast } from '@/lib/toast'
import { formatDateShort, formatEur } from '@/lib/fmt'
import { categoryTotals, selectionContribution } from '@/lib/spending'
import type { OpenExpenseWithContribution } from '@/lib/queries'

interface Props {
  expenses: OpenExpenseWithContribution[]
  otherUserName: string
  telegramEnabled: boolean
  /** Posizione ufficiale dalla vista SQL, usata per la selezione completa. */
  officialNet: number
}
interface Confirmation { fingerprint: string; amount: number }

export function ConguaglioClient({ expenses, otherUserName, telegramEnabled, officialNet }: Props) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isRequesting, startRequest] = useTransition()
  const selected = expenses.filter((e) => !excluded.has(e.id))
  const allSelected = selected.length === expenses.length
  const net = allSelected ? officialNet : selectionContribution(selected)
  const absAmount = Math.abs(net)
  const payer = net > 0 ? otherUserName : 'Tu'
  const receiver = net > 0 ? 'te' : otherUserName
  const fingerprint = selected.map((e) => e.id + ':' + e.updated_at + ':' + e.my_contribution).join('|')
  const stale = Boolean(confirmation && (confirmation.fingerprint !== fingerprint || confirmation.amount !== net))

  function toggle(id: string) {
    setExcluded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function request() {
    startRequest(async () => {
      const result = await requestSettlementOnTelegram().catch(() => ({ ok: false as const, error: 'Non riesco a confermare l’invio. Controlla il gruppo prima di riprovare.' }))
      if (result.ok) toast.success('Promemoria inviato nel gruppo Telegram.')
      else toast.error(result.error)
    })
  }
  function confirm() {
    if (!confirmation || stale || net === 0 || isPending) return
    startTransition(async () => {
      try {
        const result = await registerSettlement(undefined, selected.map((e) => e.id))
        if (result?.error) { toast.error(result.error); setConfirmation(null) }
      } catch (error) {
        if (isRedirectError(error)) throw error
        toast.error('Non riesco a confermare la registrazione. Aggiorna il saldo prima di riprovare.')
        setConfirmation(null)
      }
    })
  }

  return (
    <>
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.15fr]">
        <Card className="p-5">
          <SpendingRing categories={categoryTotals(selected)} label={allSelected ? 'Spese da regolare' : 'Spese selezionate'}>
            {selected.length === 0 ? <><p className="font-display text-2xl font-semibold">{expenses.length ? 'Scegli le spese' : 'Siete in pari'}</p><p className="mt-2 text-xs text-muted">{expenses.length ? 'Nessuna selezionata' : 'Niente da regolare'}</p></>
              : net === 0 ? <><Check className="size-6 text-accent" aria-hidden /><p className="mt-2 font-display text-2xl font-semibold">Saldo zero</p><p className="mt-2 text-xs text-muted">Le spese si compensano</p></>
              : <><p className="text-sm text-muted">{net > 0 ? 'Devi ricevere' : 'Devi dare'}</p><AmountDisplay value={absAmount} className={`mt-2 whitespace-nowrap ${absAmount >= 10000 ? 'text-[1.8rem]' : 'text-[2.5rem]'}`} /><p className="mt-2 break-words text-sm">{net > 0 ? 'da' : 'a'} {otherUserName}</p></>}
          </SpendingRing>
          {!allSelected && <p className="mt-4 rounded-2xl bg-accent-muted p-3 text-sm text-accent-soft">Stai regolando {selected.length} spese su {expenses.length}. Le altre resteranno aperte.</p>}
          <p className="mt-4 text-sm leading-relaxed text-muted">Prima esegui il bonifico, poi registralo qui. L’app tiene i conti e non trasferisce denaro.</p>
          {telegramEnabled && officialNet !== 0 && <div className="mt-3">
            <Button variant="ghost" size="sm" className="w-full" disabled={!allSelected} loading={isRequesting} onClick={request}><Bell className="size-4" aria-hidden />Invia promemoria su Telegram</Button>
            {!allSelected && <p className="mt-1 text-xs text-muted">Il promemoria riguarda il saldo completo.</p>}
          </div>}
        </Card>

        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="font-semibold">Spese da includere <span className="text-sm font-normal text-muted">({selected.length}/{expenses.length})</span></h2>
            {expenses.length > 0 && <button type="button" className="min-h-11 rounded-full px-3 text-sm font-semibold text-accent"
              onClick={() => setExcluded(allSelected ? new Set(expenses.map((e) => e.id)) : new Set())}>
              {allSelected ? 'Deseleziona tutte' : 'Seleziona tutte'}
            </button>}
          </div>
          <p className="mb-4 px-1 text-sm text-muted">Il contributo indica quanto ogni spesa è a tuo favore o a favore del partner.</p>
          {expenses.length === 0 ? <Card className="p-6 text-center"><p className="text-muted">Non ci sono spese aperte.</p><Link href="/" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-accent"><ArrowLeft className="size-4" aria-hidden />Torna alla home</Link></Card>
            : <Card className="divide-y divide-border overflow-hidden">
              {expenses.map((e) => <label key={e.id} className="flex cursor-pointer items-start gap-2 py-4 pr-4 pl-1">
                <Checkbox checked={!excluded.has(e.id)} onChange={() => toggle(e.id)} disabled={isPending} aria-label={`Includi ${e.description}`} />
                <div className="pt-1"><CategoryIcon category={e.category} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><p className="break-words text-sm font-semibold">{e.description}</p><span className="text-sm font-semibold tabular-nums">{formatEur(e.amount)}</span></div>
                  <p className="mt-1 text-xs text-muted">{formatDateShort(e.expense_date)} · {e.paid_by_profile?.display_name ?? '—'} ha pagato</p>
                  <p className="mt-2 text-xs"><span className="font-semibold tabular-nums">{e.my_contribution > 0 ? '+' : ''}{formatEur(e.my_contribution)}</span><span className="text-muted"> · {e.my_contribution > 0 ? 'a tuo favore' : e.my_contribution < 0 ? 'a favore del partner' : 'nessun contributo'}</span></p>
                </div>
              </label>)}
            </Card>}
        </section>
      </div>

      {expenses.length > 0 && <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-md lg:bottom-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm"><p className="font-semibold">{selected.length} spese selezionate</p><p className="mt-1 text-muted">{net !== 0 ? `${payer} → ${receiver} · ${formatEur(absAmount)}` : selected.length ? 'Niente da versare' : 'Seleziona almeno una spesa'}</p></div>
          <Button size="lg" disabled={net === 0 || selected.length === 0} onClick={() => setConfirmation({ fingerprint, amount: net })}>Registra bonifico effettuato</Button>
        </div>
      </div>}

      <Sheet open={Boolean(confirmation)} onOpenChange={(open) => { if (!open && !isPending) setConfirmation(null) }}
        title="Il bonifico è già stato fatto?"
        description="Conferma per segnare queste spese come saldate."
        footer={<div className="flex flex-wrap gap-3"><Button variant="outline" className="flex-1" disabled={isPending} onClick={() => setConfirmation(null)}>Torna al riepilogo</Button><Button className="flex-1" disabled={stale} loading={isPending} onClick={confirm}>Sì, registra</Button></div>}>
        <div className="space-y-5 px-5 py-6 text-center">
          <AmountDisplay value={absAmount} size="display-sm" />
          <p className="flex items-center justify-center gap-3 font-semibold">{payer}<ArrowRight className="size-4" aria-hidden />{receiver}</p>
          <p className="text-sm text-muted">{allSelected ? 'Tutte le spese aperte' : `Le ${selected.length} spese selezionate`} verranno segnate come saldate.{!allSelected && ' Le altre restano nel saldo corrente.'}</p>
          {stale && <p role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">Le spese sono cambiate. Torna al riepilogo prima di confermare.</p>}
        </div>
      </Sheet>
    </>
  )
}
