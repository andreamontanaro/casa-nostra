'use client'

import { useActionState, useState } from 'react'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import {
  updateExpense,
  deleteExpense,
  type ExpenseFormState,
} from '@/app/actions/expenses'
import { AttachmentUploader } from '@/components/AttachmentUploader'
import { ExpenseFormFields } from '@/components/expense/ExpenseFormFields'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { DEFAULT_SPLIT } from '@/lib/fmt'
import { Tables, Constants } from '@/types/database'
import { toast } from '@/lib/toast'

type Profile = Tables<'profiles'>
type Expense = Tables<'expenses'>
type Category = (typeof Constants.public.Enums.expense_category)[number]
type SplitRule = (typeof Constants.public.Enums.split_rule)[number]

interface EditExpenseFormProps {
  expense: Expense
  profiles: Profile[]
  currentUserId: string
  attachmentCount: number
}

export function EditExpenseForm({
  expense,
  profiles,
  currentUserId,
  attachmentCount,
}: EditExpenseFormProps) {
  const boundUpdate = updateExpense.bind(null, expense.id)
  const [state, action, pending] = useActionState<ExpenseFormState, FormData>(
    boundUpdate,
    {},
  )
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [category, setCategory] = useState<Category>(expense.category)
  const [splitRule, setSplitRule] = useState<SplitRule>(expense.split_rule)
  const [paidBy, setPaidBy] = useState(expense.paid_by)
  const [rawAmount, setRawAmount] = useState(String(expense.amount))
  const [description, setDescription] = useState(expense.description)
  const [customOtherShare, setCustomOtherShare] = useState(
    expense.custom_other_share != null ? String(expense.custom_other_share) : '',
  )
  const [expenseDate, setExpenseDate] = useState(expense.expense_date)

  const isSettled = expense.settlement_id !== null

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteExpense(expense.id)
    } catch (e) {
      if (isRedirectError(e)) throw e
      toast.error("Errore durante l'eliminazione.")
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  function handleCategoryChange(cat: Category) {
    // Adegua la divisione al default della nuova categoria SOLO se coincide
    // ancora col default della precedente: così non sovrascrive una divisione
    // già salvata o scelta a mano.
    if (splitRule === DEFAULT_SPLIT[category]) {
      setSplitRule(DEFAULT_SPLIT[cat])
    }
    setCategory(cat)
  }

  return (
    <>
      <form action={action} className="flex flex-col gap-5 px-4 pt-4 pb-6">
        {isSettled && (
          <div className="rounded-2xl border border-border bg-surface-raised px-4 py-3 text-sm text-muted">
            Questa spesa è già saldata e non può essere modificata.
          </div>
        )}

        <ExpenseFormFields
          profiles={profiles}
          currentUserId={currentUserId}
          disabled={pending || isSettled}
          fieldErrors={state.fieldErrors}
          amount={rawAmount}
          onAmountChange={setRawAmount}
          description={description}
          onDescriptionChange={setDescription}
          category={category}
          onCategoryChange={handleCategoryChange}
          splitRule={splitRule}
          onSplitRuleChange={setSplitRule}
          customOtherShare={customOtherShare}
          onCustomOtherShareChange={setCustomOtherShare}
          paidBy={paidBy}
          onPaidByChange={setPaidBy}
          expenseDate={expenseDate}
          onExpenseDateChange={setExpenseDate}
          attachmentsSlot={
            !isSettled ? (
              <div className="flex flex-col gap-2">
                <span className="text-label font-medium text-muted">
                  Aggiungi allegato
                </span>
                <AttachmentUploader
                  mode="immediate"
                  expenseId={expense.id}
                  uploadedBy={currentUserId}
                  existingCount={attachmentCount}
                  disabled={pending}
                />
              </div>
            ) : null
          }
        />

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        {!isSettled && (
          <div className="mt-1 flex flex-col gap-3">
            <Button type="submit" size="lg" loading={pending} className="w-full">
              Salva modifiche
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="w-full"
              onClick={() => setDeleteOpen(true)}
              disabled={pending}
            >
              Elimina spesa
            </Button>
          </div>
        )}
      </form>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Elimina spesa"
        description="Sei sicuro di voler eliminare questa spesa? L'operazione non può essere annullata."
        confirmLabel="Elimina"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  )
}
