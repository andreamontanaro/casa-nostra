'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { registerSettlement } from '@/app/actions/settlement'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { toast } from '@/lib/toast'
import { CATEGORY_LABELS, formatDate, formatEur } from '@/lib/fmt'
import { cn } from '@/lib/utils'
import type { OpenExpenseWithContribution } from '@/lib/queries'

interface ConguaglioClientProps {
  expenses: OpenExpenseWithContribution[]
  otherUserName: string
}

export function ConguaglioClient({
  expenses,
  otherUserName,
}: ConguaglioClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(expenses.map((e) => e.id)),
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

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
        setDialogOpen(false)
      }
    })
  }

  const dialogDescription = allSelected
    ? 'Tutte le spese aperte verranno marcate come saldate. Assicurati che il bonifico sia già avvenuto.'
    : `Verranno marcate come saldate solo le ${selectedCount} spese selezionate. Le altre resteranno aperte. Assicurati che il bonifico sia già avvenuto.`

  return (
    <>
      {/* Card saldo netto */}
      {!hasBalance ? (
        <div className="flex flex-col items-center gap-3 px-1 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted text-accent-soft">
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
        <div className="relative px-1 py-2 text-foreground">
          <div className="relative flex flex-col items-center gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              Saldo netto
            </p>
            <p className="text-4xl font-bold tracking-tight tabular-nums">
              {formatEur(absAmount)}
            </p>
            <div className="flex items-center gap-3 rounded-full bg-accent-muted px-3 py-1 text-sm font-medium text-accent-soft">
              <span className={isCredit ? 'text-foreground' : ''}>
                {payer}
              </span>
              <ArrowRight className="size-4" strokeWidth={2.5} />
              <span className={!isCredit ? 'text-foreground' : ''}>
                {receiver}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Lista spese con checkbox */}
      {totalCount > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
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
          <Card className="divide-y divide-border overflow-hidden bg-surface/86 p-0 backdrop-blur">
            {expenses.map((e) => {
              const checked = selectedIds.has(e.id)
              return (
                <label
                  key={e.id}
                  className={cn(
                    'flex min-h-12 cursor-pointer items-center gap-3 px-4 py-3 transition-opacity',
                    !checked && 'opacity-50',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onChange={() => toggle(e.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-sm font-medium text-foreground',
                        !checked && 'line-through',
                      )}
                    >
                      {e.description}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(e.expense_date)} ·{' '}
                      {CATEGORY_LABELS[e.category]}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'ml-3 shrink-0 text-sm font-semibold tabular-nums text-foreground',
                      !checked && 'line-through',
                    )}
                  >
                    {formatEur(e.amount)}
                  </span>
                </label>
              )
            })}
          </Card>
        </section>
      )}

      {/* Barra azione: mostrata solo se c'è qualcosa da conguagliare, così non
          resta un bottone disabilitato "morto" quando non ci sono spese aperte. */}
      {totalCount > 0 && (
        <div
          className={cn(
            'sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4',
            'border-t border-border',
            'bg-surface/85 backdrop-blur-xl backdrop-saturate-150',
            'supports-[backdrop-filter]:bg-surface/75',
            'px-4 pt-3 pb-3',
            'flex flex-col gap-2',
          )}
        >
          <Button
            size="lg"
            className="w-full"
            disabled={!hasBalance}
            onClick={() => setDialogOpen(true)}
          >
            Registra conguaglio
          </Button>
          {!hasBalance && (
            <p className="text-center text-sm text-muted">
              {selectedCount === 0
                ? 'Seleziona almeno una spesa per conguagliare.'
                : 'Le spese selezionate si compensano, niente da conguagliare.'}
            </p>
          )}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Conferma conguaglio"
        description={dialogDescription}
        confirmLabel="Conferma"
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  )
}
