import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import {
  getExpenseById,
  getProfiles,
  getCurrentUser,
  getExpenseAttachments,
} from '@/lib/queries'
import { EditExpenseForm } from './EditExpenseForm'
import { AttachmentList } from '@/components/AttachmentList'
import { CategoryIcon } from '@/components/CategoryIcon'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ListRow } from '@/components/ui/ListRow'
import { formatDate, formatEur, CATEGORY_LABELS, SPLIT_LABELS } from '@/lib/fmt'

function splitLabel(expense: { split_rule: string; custom_other_share: number | null }) {
  if (expense.split_rule === 'custom' && expense.custom_other_share != null) {
    return `${SPLIT_LABELS['custom']} (${formatEur(expense.custom_other_share)})`
  }
  return SPLIT_LABELS[expense.split_rule]
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function SpesaDetailPage({ params }: Props) {
  const { id } = await params

  const [expense, profiles, user, attachments] = await Promise.all([
    getExpenseById(id).catch(() => null),
    getProfiles(),
    getCurrentUser(),
    getExpenseAttachments(id).catch(() => []),
  ])

  if (!expense || !user) notFound()

  const paidByProfile = profiles.find((p) => p.id === expense.paid_by)
  const isSettled = expense.settlement_id !== null

  return (
    <div className="flex flex-col pb-4">
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        <Link
          href="/spese"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised"
          aria-label="Torna allo storico"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold leading-tight text-foreground">
          Dettaglio spesa
        </h1>
      </header>

      {/* Hero recap */}
      <section className="px-4 pb-5">
        <div className="flex items-start gap-4">
          <CategoryIcon category={expense.category} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-title font-semibold text-foreground">
              {expense.description}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {formatDate(expense.expense_date)}
            </p>
          </div>
          <Badge variant={isSettled ? 'muted' : 'positive'}>
            {isSettled ? 'Saldata' : 'Aperta'}
          </Badge>
        </div>
        <div className="mt-4">
          <AmountDisplay value={expense.amount} size="display-sm" />
        </div>
      </section>

      {/* Transaction detail */}
      <div className="px-4 pb-5">
        <Card className="divide-y divide-border overflow-hidden p-0">
          <ListRow
            title={<span className="font-normal text-muted">Pagato da</span>}
            trailing={
              <span className="text-sm font-semibold text-foreground">
                {paidByProfile?.display_name ?? '—'}
              </span>
            }
          />
          <ListRow
            title={<span className="font-normal text-muted">Categoria</span>}
            trailing={
              <span className="text-sm font-semibold text-foreground">
                {CATEGORY_LABELS[expense.category]}
              </span>
            }
          />
          <ListRow
            title={<span className="font-normal text-muted">Divisione</span>}
            trailing={
              <span className="text-sm font-semibold text-foreground">
                {splitLabel(expense)}
              </span>
            }
          />
          <ListRow
            title={<span className="font-normal text-muted">Importo</span>}
            trailing={
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {formatEur(expense.amount)}
              </span>
            }
          />
        </Card>
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-col gap-2 px-4 pb-5">
          <span className="text-label font-medium text-muted">Allegati</span>
          <AttachmentList attachments={attachments} readOnly={isSettled} />
        </div>
      )}

      <hr className="border-border" />

      <EditExpenseForm
        expense={expense}
        profiles={profiles}
        currentUserId={user.id}
        attachmentCount={attachments.length}
      />
    </div>
  )
}
