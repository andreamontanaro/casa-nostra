import Link from 'next/link'
import { formatEur, CATEGORY_LABELS } from '@/lib/fmt'
import { Badge } from '@/components/ui/Badge'
import { Tables } from '@/types/database'

type Expense = Tables<'expenses'> & {
  paid_by_profile: { display_name: string } | null
}

interface ExpenseRowProps {
  expense: Expense
}

export function ExpenseRow({ expense }: ExpenseRowProps) {
  const isSettled = expense.settlement_id !== null

  return (
    <Link
      href={`/spese/${expense.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-raised active:bg-border transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {expense.description}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {expense.paid_by_profile?.display_name} ·{' '}
          {CATEGORY_LABELS[expense.category]}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-semibold text-foreground">
          {formatEur(expense.amount)}
        </span>
        {isSettled && (
          <Badge variant="muted">saldata</Badge>
        )}
      </div>
    </Link>
  )
}
