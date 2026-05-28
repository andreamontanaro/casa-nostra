'use client'

import { useActionState, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import {
  updateExpense,
  deleteExpense,
  type ExpenseFormState,
} from '@/app/actions/expenses'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import {
  CATEGORY_LABELS,
  CATEGORY_ICON,
  SPLIT_LABELS,
  formatEur,
} from '@/lib/fmt'
import { Tables, Constants } from '@/types/database'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

type Profile = Tables<'profiles'>
type Expense = Tables<'expenses'>
type Category = (typeof Constants.public.Enums.expense_category)[number]
type SplitRule = (typeof Constants.public.Enums.split_rule)[number]

const DEFAULT_SPLIT: Record<Category, SplitRule> = {
  affitto: 'fifty_fifty',
  bolletta: 'sixty_forty',
  spesa_alimentare: 'sixty_forty',
  abbonamento: 'sixty_forty',
  manutenzione: 'sixty_forty',
  viaggi: 'fifty_fifty',
  altro: 'sixty_forty',
}

interface EditExpenseFormProps {
  expense: Expense
  profiles: Profile[]
  currentUserId: string
}

export function EditExpenseForm({
  expense,
  profiles,
  currentUserId,
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
  const [customOtherShare, setCustomOtherShare] = useState(
    expense.custom_other_share != null ? String(expense.custom_other_share) : '',
  )

  const isSettled = expense.settlement_id !== null
  const otherProfile = profiles.find((p) => p.id !== paidBy)
  const parsedAmount = parseFloat(rawAmount.replace(',', '.'))
  const parsedCustomShare = parseFloat(customOtherShare.replace(',', '.'))
  const showCustomPreview =
    splitRule === 'custom' &&
    !isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    !isNaN(parsedCustomShare) &&
    parsedCustomShare > 0 &&
    parsedCustomShare < parsedAmount

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
    setCategory(cat)
    setSplitRule(DEFAULT_SPLIT[cat])
  }

  return (
    <>
      <form action={action} className="flex flex-col gap-5 px-4 pt-2 pb-6">
        {isSettled && (
          <div className="rounded-2xl border border-border bg-surface-raised px-4 py-3 text-sm text-muted">
            Questa spesa è già saldata e non può essere modificata.
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            Importo (€)
          </label>
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            required
            disabled={pending || isSettled}
            value={rawAmount}
            onChange={(e) => setRawAmount(e.target.value)}
            className={cn(
              'h-16 w-full rounded-2xl border border-border bg-surface px-4',
              'text-3xl font-bold tracking-tight text-foreground tabular-nums',
              'placeholder:text-muted/60 shadow-soft',
              'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
              'disabled:opacity-50',
            )}
          />
          {state.fieldErrors?.amount && (
            <p className="text-xs text-destructive">{state.fieldErrors.amount}</p>
          )}
        </div>

        <Input
          label="Descrizione"
          name="description"
          defaultValue={expense.description}
          required
          disabled={pending || isSettled}
          error={state.fieldErrors?.description}
        />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Categoria</span>
          <div className="grid grid-cols-3 gap-2">
            {Constants.public.Enums.expense_category.map((cat) => {
              const isActive = category === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  disabled={pending || isSettled}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5',
                    'text-sm font-medium transition-[border-color,background-color,color,transform] duration-150',
                    'active:scale-[0.97]',
                    isActive
                      ? 'border-accent bg-accent-muted text-accent shadow-soft'
                      : 'border-border bg-surface text-muted hover:border-accent/40',
                  )}
                >
                  <span className="text-base leading-none">
                    {CATEGORY_ICON[cat]}
                  </span>
                  <span className="truncate">{CATEGORY_LABELS[cat]}</span>
                </button>
              )
            })}
          </div>
          <input type="hidden" name="category" value={category} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Divisione</span>
          <div className="flex gap-2">
            {Constants.public.Enums.split_rule.map((rule) => (
              <button
                key={rule}
                type="button"
                onClick={() => setSplitRule(rule)}
                disabled={pending || isSettled}
                className={cn(
                  'flex-1 rounded-2xl border py-2.5 text-sm font-medium transition-[border-color,background-color,color,transform] duration-150',
                  'active:scale-[0.97]',
                  splitRule === rule
                    ? 'border-accent bg-accent-muted text-accent shadow-soft'
                    : 'border-border bg-surface text-muted hover:border-accent/40',
                )}
              >
                {SPLIT_LABELS[rule]}
              </button>
            ))}
          </div>
          <input type="hidden" name="split_rule" value={splitRule} />
        </div>

        <AnimatePresence initial={false}>
          {splitRule === 'custom' && (
            <motion.div
              key="custom-share"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Quota di {otherProfile?.display_name ?? 'altra persona'} (€)
                </label>
                <input
                  name="custom_other_share"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={customOtherShare}
                  onChange={(e) => setCustomOtherShare(e.target.value)}
                  disabled={pending || isSettled}
                  className={cn(
                    'h-12 w-full rounded-2xl border border-border bg-surface px-4',
                    'text-xl font-semibold text-foreground tabular-nums shadow-soft',
                    'placeholder:text-muted',
                    'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
                    'disabled:opacity-50',
                  )}
                />
                {showCustomPreview && (
                  <p className="text-xs text-muted tabular-nums">
                    La tua quota: {formatEur(parsedAmount - parsedCustomShare)}
                  </p>
                )}
                {state.fieldErrors?.custom_other_share && (
                  <p className="text-xs text-destructive">
                    {state.fieldErrors.custom_other_share}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {splitRule !== 'custom' && (
          <input type="hidden" name="custom_other_share" value="" />
        )}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Pagato da</span>
          <div className="flex gap-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaidBy(p.id)}
                disabled={pending || isSettled}
                className={cn(
                  'flex-1 rounded-2xl border py-2.5 text-sm font-medium transition-[border-color,background-color,color,transform] duration-150',
                  'active:scale-[0.97]',
                  paidBy === p.id
                    ? 'border-accent bg-accent-muted text-accent shadow-soft'
                    : 'border-border bg-surface text-muted hover:border-accent/40',
                )}
              >
                {p.id === currentUserId ? 'Io' : p.display_name}
              </button>
            ))}
          </div>
          <input type="hidden" name="paid_by" value={paidBy} />
        </div>

        <Input
          label="Data"
          name="expense_date"
          type="date"
          defaultValue={expense.expense_date}
          required
          disabled={pending || isSettled}
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
