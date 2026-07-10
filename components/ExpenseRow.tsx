import { formatEur, CATEGORY_LABELS } from '@/lib/fmt'
import { Badge } from '@/components/ui/Badge'
import { ListRow } from '@/components/ui/ListRow'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Tables } from '@/types/database'

type Expense = Tables<'expenses'> & {
  paid_by_profile: { display_name: string } | null
}

interface ExpenseRowProps {
  expense: Expense
  dateLabel?: string
}

export function ExpenseRow({ expense, dateLabel }: ExpenseRowProps) {
  const isSettled = expense.settlement_id !== null

  return (
    <ListRow
      href={`/spese/${expense.id}`}
      leading={<CategoryIcon category={expense.category} size="md" />}
      title={expense.description}
      subtitle={`${expense.paid_by_profile?.display_name ?? '—'} · ${CATEGORY_LABELS[expense.category]}`}
      trailing={
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatEur(expense.amount)}
          </span>
          {dateLabel && <span className="text-xs text-muted">{dateLabel}</span>}
          {isSettled && <Badge variant="muted">saldata</Badge>}
        </div>
      }
    />
  )
}
