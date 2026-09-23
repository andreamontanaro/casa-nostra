import { formatEur, CATEGORY_LABELS, SPLIT_LABELS } from '@/lib/fmt'
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
}

export function ExpenseRow({ expense, dateLabel, returnHref, contribution }: ExpenseRowProps) {
  const isSettled = expense.settlement_id !== null

  return (
    <ListRow
      href={`/spese/${expense.id}${returnHref ? `?ritorno=${encodeURIComponent(returnHref)}` : ''}`}
      leading={<CategoryIcon category={expense.category} size="md" />}
      title={expense.description}
      subtitle={`${expense.paid_by_profile?.display_name ?? '—'} · ${CATEGORY_LABELS[expense.category]} · ${SPLIT_LABELS[expense.split_rule]}`}
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
 * «+7,20 € per te» / «−4,80 € per te»: quanto la spesa sposta il saldo di chi
 * guarda. Aperta è lo stato di quasi tutte le righe recenti, quindi al posto
 * del badge di stato si mostra l'informazione che serve davvero. Il segno e
 * le parole portano il significato; il colore lo accompagna soltanto.
 */
function ContributionBadge({ value }: { value: number }) {
  const amount = formatEur(Math.abs(value))
  const visible = value > 0 ? `+${amount} per te` : value < 0 ? `−${amount} per te` : 'In pari'
  const spoken = value > 0
    ? `Aperta, ${amount} a tuo favore`
    : value < 0 ? `Aperta, ${amount} a tuo carico` : 'Aperta, nessun effetto sul saldo'
  return (
    <Badge variant={value > 0 ? 'positive' : 'default'} className="tabular-nums whitespace-nowrap">
      <span aria-hidden>{visible}</span>
      <span className="sr-only">{spoken}</span>
    </Badge>
  )
}
