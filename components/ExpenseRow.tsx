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
}

export function ExpenseRow({ expense, dateLabel, returnHref }: ExpenseRowProps) {
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
          <Badge variant={isSettled ? 'muted' : 'positive'}>{isSettled ? 'Saldata' : 'Aperta'}</Badge>
        </div>
      }
    />
  )
}
