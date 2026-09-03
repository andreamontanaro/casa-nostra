'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowRight, Bell, Check } from 'lucide-react'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { registerSettlement } from '@/app/actions/settlement'
import { requestSettlementOnTelegram } from '@/app/actions/telegram'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Sheet } from '@/components/ui/Sheet'
import { CategoryIcon } from '@/components/CategoryIcon'
import { toast } from '@/lib/toast'
import { CATEGORY_LABELS, formatDate, formatEur } from '@/lib/fmt'
import { cn } from '@/lib/utils'
import type { OpenExpenseWithContribution } from '@/lib/queries'

interface ConguaglioClientProps {
  expenses: OpenExpenseWithContribution[]
  otherUserName: string
  /** Il bot Telegram è configurato: si può sollecitare il conguaglio nel gruppo. */
  telegramEnabled: boolean
}

function DirectionPill({ payer, receiver }: { payer: string; receiver: string }) {
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium">
      <span className="text-foreground">{payer}</span>
      <ArrowRight className="size-4 shrink-0 text-muted" strokeWidth={2.5} />
      <span className="text-foreground">{receiver}</span>
    </div>
  )
}

export function ConguaglioClient({
  expenses,
  otherUserName,
  telegramEnabled,
}: ConguaglioClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(expenses.map((e) => e.id)),
  )
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isRequesting, startRequest] = useTransition()

  const net = useMemo(() => {
    let sum = 0
    for (const e of expenses) {
      if (selectedIds.has(e.id)) sum += e.my_contribution
    }
    return Math.round(sum * 100) / 100
  }, [expenses, selectedIds])

  const absAmount = Math.abs(net)
  const hasBalance = net !== 0
  const isCredit = net > 0
  const payer = isCredit ? otherUserName : 'Tu'
  const receiver = isCredit ? 'Te' : otherUserName

  const selectedCount = selectedIds.size
  const totalCount = expenses.length
  const allSelected = selectedCount === totalCount

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === totalCount ? new Set() : new Set(expenses.map((e) => e.id)),
    )
  }

  // Manda solo un promemoria nel gruppo: il conguaglio si registra qui, dopo
  // che il bonifico è partito.
  function handleRequest() {
    startRequest(async () => {
      const result = await requestSettlementOnTelegram()
      if (result.ok) toast.success('Richiesta inviata nel gruppo Telegram.')
      else toast.error(result.error)
    })
  }

  function handleConfirm() {
    if (!hasBalance) return
    const ids = expenses
      .filter((e) => selectedIds.has(e.id))
      .map((e) => e.id)
    startTransition(async () => {
      try {
        await registerSettlement(undefined, ids)
      } catch (e) {
        if (isRedirectError(e)) throw e
        toast.error('Errore durante il conguaglio. Riprova.')
        setConfirmOpen(false)
      }
    })
  }

  return (
    <>
      {/* Hero saldo netto */}
      {!hasBalance ? (
        <div className="flex flex-col items-center gap-3 px-1 py-6">
          <div className="flex size-12 items-center justify-center rounded-full bg-positive-muted text-positive-soft">
            <Check className="size-6" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">
              {totalCount === 0 || selectedCount === 0
                ? 'Siete pari'
                : 'Nessun saldo sulla selezione'}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {totalCount === 0
                ? 'Niente da conguagliare.'
                : selectedCount === 0
                  ? 'Seleziona almeno una spesa.'
                  : 'Le spese selezionate si compensano.'}
            </p>
          </div>
          {totalCount === 0 && (
            <Link
              href="/"
              className="mt-1 text-sm font-medium text-accent hover:underline"
            >
              Torna alla home
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-label font-medium uppercase tracking-wider text-muted">
            Saldo netto
          </p>
          <AmountDisplay value={absAmount} size="display" />
          <DirectionPill payer={payer} receiver={receiver} />
          {telegramEnabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRequest}
              loading={isRequesting}
            >
              <Bell className="size-4" strokeWidth={2.5} />
              Richiedi conguaglio
            </Button>
          )}
        </div>
      )}

      {/* Lista spese con checkbox */}
      {totalCount > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <h2 className="text-label font-semibold uppercase tracking-wide text-muted">
              Spese ({selectedCount}/{totalCount})
            </h2>
            <button
              type="button"
              onClick={toggleAll}
              className="text-sm font-medium text-accent hover:underline"
            >
              {allSelected ? 'Deseleziona tutte' : 'Seleziona tutte'}
            </button>
          </div>
          <Card className="divide-y divide-border overflow-hidden p-0">
            {expenses.map((e) => {
              const checked = selectedIds.has(e.id)
              return (
                <label
                  key={e.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 py-2 pl-1 pr-4 transition-opacity',
                    !checked && 'opacity-60',
                  )}
                >
                  <Checkbox checked={checked} onChange={() => toggle(e.id)} />
                  <CategoryIcon category={e.category} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {e.description}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(e.expense_date)} · {CATEGORY_LABELS[e.category]}
                    </p>
                  </div>
                  <span className="ml-2 shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatEur(e.amount)}
                  </span>
                </label>
              )
            })}
          </Card>
        </section>
      )}

      {/* Barra azione solida, fusa con la BottomNav (un solo border-t) */}
      {totalCount > 0 && (
        <div
          className={cn(
            'sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4',
            'border-t border-border bg-background px-4 pt-3 pb-3',
          )}
        >
          {hasBalance ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  {selectedCount} {selectedCount === 1 ? 'spesa' : 'spese'}
                </p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatEur(absAmount)}
                </p>
              </div>
              <Button
                size="lg"
                className="flex-[2]"
                onClick={() => setConfirmOpen(true)}
              >
                Conguaglia
              </Button>
            </div>
          ) : (
            <p className="text-center text-sm text-muted">
              {selectedCount === 0
                ? 'Seleziona almeno una spesa per conguagliare.'
                : 'Le spese selezionate si compensano, niente da conguagliare.'}
            </p>
          )}
        </div>
      )}

      {/* Sheet payment-confirm */}
      <Sheet
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!isPending) setConfirmOpen(o)
        }}
        title="Conferma conguaglio"
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Annulla
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={handleConfirm}
              loading={isPending}
            >
              Conferma
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-4 px-4 pb-4 pt-2">
          <AmountDisplay value={absAmount} size="display-sm" />
          <DirectionPill payer={payer} receiver={receiver} />
          <p className="text-center text-sm text-muted">
            {allSelected
              ? `Verranno marcate come saldate tutte le ${selectedCount} spese aperte.`
              : `Verranno marcate come saldate le ${selectedCount} spese selezionate; le altre resteranno aperte.`}
            {' '}Assicurati che il bonifico sia già avvenuto.
          </p>
        </div>
      </Sheet>
    </>
  )
}
