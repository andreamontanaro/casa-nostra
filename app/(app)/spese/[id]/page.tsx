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
import { Badge } from '@/components/ui/Badge'
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
    <div className="flex flex-col">
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        <Link
          href="/spese"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-raised transition-colors text-muted"
          aria-label="Torna allo storico"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground leading-tight">
            {expense.description}
          </h1>
          <p className="text-xs text-muted">{formatDate(expense.expense_date)}</p>
        </div>
        {expense.settlement_id && <Badge variant="muted">saldata</Badge>}
      </header>

      <div className="flex gap-4 px-4 pb-4">
        <Stat label="Importo" value={formatEur(expense.amount)} />
        <Stat label="Pagato da" value={paidByProfile?.display_name ?? '—'} />
        <Stat label="Categoria" value={CATEGORY_LABELS[expense.category]} />
        <Stat label="Divisione" value={splitLabel(expense)} />
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          <span className="text-sm font-medium text-foreground">Allegati</span>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}
