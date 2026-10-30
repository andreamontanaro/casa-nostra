import { formatEur, CATEGORY_LABELS, splitLabel } from '@/lib/fmt'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ListRow } from '@/components/ui/ListRow'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Tables } from '@/types/database'

type Expense = Tables<'expenses'> & {
  paid_by_profile: { display_name: string } | null
}

interface ExpenseRowProps {
  expense: Expense
  returnHref?: string
  dateLabel?: string
  /**
   * Effetto della spesa sul saldo di chi guarda (anticipato meno quota, da
   * `v_expense_shares`). Solo per le spese aperte: una saldata non pesa più.
   */
  contribution?: number
  /** I due profili: servono a nominare chi porta una spesa «a carico di». */
  profiles?: { id: string; display_name: string }[]
}

export function ExpenseRow({ expense, dateLabel, returnHref, contribution, profiles }: ExpenseRowProps) {
  const isSettled = expense.settlement_id !== null
  const chargedTo = profiles?.find((p) => p.id !== expense.paid_by)?.display_name

  return (
    <ListRow
      href={`/spese/${expense.id}${returnHref ? `?ritorno=${encodeURIComponent(returnHref)}` : ''}`}
      leading={<CategoryIcon category={expense.category} size="md" />}
      title={expense.description}
      subtitle={`${expense.paid_by_profile?.display_name ?? '—'} · ${CATEGORY_LABELS[expense.category]} · ${splitLabel(expense.split_rule, chargedTo)}`}
      trailing={
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatEur(expense.amount)}
          </span>
          {dateLabel && <span className="text-xs text-muted">{dateLabel}</span>}
          {isSettled ? (
            <Badge variant="muted">Saldata</Badge>
          ) : contribution != null ? (
            <ContributionBadge value={contribution} />
          ) : (
            <Badge variant="positive">Aperta</Badge>
          )}
        </div>
      }
    />
  )
}

/**
 * Quanto la spesa sposta il saldo di chi guarda, come le chiamate in un
 * registro: freccia in su a destra se è a tuo carico (soldi che escono),
 * in giù a sinistra se è a tuo favore (soldi che entrano), e l'importo
 * senza segno. Aperta è lo stato di quasi tutte le righe recenti, quindi al
 * posto del badge di stato si mostra l'informazione che serve davvero. La
 * direzione della freccia porta il significato, il colore lo accompagna, e
 * chi usa uno screen reader sente la frase intera.
 */
function ContributionBadge({ value }: { value: number }) {
  const amount = formatEur(Math.abs(value))
  const spoken = value > 0
    ? `Aperta, ${amount} a tuo favore`
    : value < 0 ? `Aperta, ${amount} a tuo carico` : 'Aperta, nessun effetto sul saldo'
  const Arrow = value > 0 ? ArrowDownLeft : ArrowUpRight
  return (
    <span className={`inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-semibold tabular-nums ${value > 0 ? 'text-positive' : 'text-muted'}`}>
      <span aria-hidden className="inline-flex items-center gap-0.5">
        {value !== 0 && <Arrow className="size-3.5" strokeWidth={2.5} />}{value !== 0 ? amount : 'In pari'}
      </span>
      <span className="sr-only">{spoken}</span>
    </span>
  )
}
