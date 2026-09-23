import { ArrowLeftRight, ArrowRight } from 'lucide-react'
import { IntentLink } from '@/components/ui/IntentLink'
import { formatEur } from '@/lib/fmt'
import { cn } from '@/lib/utils'
import type { SettlementWithNames } from '@/lib/queries'

interface SettlementRowProps {
  settlement: SettlementWithNames
  /** Spese chiuse da questo conguaglio, contate sullo storico già caricato. */
  expenseCount: number
  /** Senza `href` la riga è solo informativa: lo storico è già filtrato su di lei. */
  href?: string
}

/**
 * Un conguaglio dentro lo storico, al suo posto nel tempo. Non è una spesa e
 * non deve sembrarlo: niente card condivisa con le righe, bordo tratteggiato,
 * l'icona della voce "Regola il saldo". L'importo non entra nei totali.
 */
export function SettlementRow({ settlement, expenseCount, href }: SettlementRowProps) {
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent-soft">
        <ArrowLeftRight className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Conguaglio</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-muted">
          <span>{settlement.from_user?.display_name ?? '—'}</span>
          <ArrowRight className="size-3.5 shrink-0" aria-hidden />
          <span className="sr-only">ha versato a</span>
          <span>{settlement.to_user?.display_name ?? '—'}</span>
          <span aria-hidden>·</span>
          <span>{expenseCount} {expenseCount === 1 ? 'spesa chiusa' : 'spese chiuse'}</span>
        </p>
        {settlement.notes && (
          <p className="mt-1 break-words text-xs text-muted">«{settlement.notes}»</p>
        )}
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {formatEur(settlement.amount)}
      </span>
    </>
  )
  const base = 'flex w-full items-center gap-3 rounded-2xl border border-dashed border-border-strong px-4 py-3 text-left'

  if (!href) return <div className={base}>{content}</div>
  return (
    <IntentLink href={href} className={cn(base, 'transition-colors hover:bg-surface-raised active:bg-border')}>
      {content}
    </IntentLink>
  )
}
