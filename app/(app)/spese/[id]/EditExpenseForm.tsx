'use client'

import { useActionState, useState } from 'react'
import { updateExpense, deleteExpense, type ExpenseFormState } from '@/app/actions/expenses'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { CATEGORY_LABELS, SPLIT_LABELS } from '@/lib/fmt'
import { Tables, Constants } from '@/types/database'
import { toast } from '@/lib/toast'

type Profile = Tables<'profiles'>
type Expense = Tables<'expenses'>
type Category = typeof Constants.public.Enums.expense_category[number]
type SplitRule = typeof Constants.public.Enums.split_rule[number]

const DEFAULT_SPLIT: Record<Category, SplitRule> = {
  affitto: 'fifty_fifty',
  bolletta: 'sixty_forty',
  spesa_alimentare: 'sixty_forty',
  abbonamento: 'sixty_forty',
  manutenzione: 'sixty_forty',
  altro: 'sixty_forty',
}

interface EditExpenseFormProps {
  expense: Expense
  profiles: Profile[]
  currentUserId: string
}

export function EditExpenseForm({ expense, profiles, currentUserId }: EditExpenseFormProps) {
  const boundUpdate = updateExpense.bind(null, expense.id)
  const [state, action, pending] = useActionState<ExpenseFormState, FormData>(boundUpdate, {})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [category, setCategory] = useState<Category>(expense.category)
  const [splitRule, setSplitRule] = useState<SplitRule>(expense.split_rule)
  const [paidBy, setPaidBy] = useState(expense.paid_by)

  const isSettled = expense.settlement_id !== null

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteExpense(expense.id)
    } catch {
      toast.error('Errore durante l\'eliminazione.')
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
          <div className="rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-muted">
            Questa spesa è già saldata e non può essere modificata.
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Importo (€)</label>
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            defaultValue={String(expense.amount)}
            required
            disabled={pending || isSettled}
            className="h-14 w-full rounded-xl border border-border bg-surface px-4 text-2xl font-semibold text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50"
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
          <div className="flex flex-wrap gap-2">
            {Constants.public.Enums.expense_category.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                disabled={pending || isSettled}
                className={[
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  category === cat
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-border bg-surface text-muted hover:border-accent/50',
                ].join(' ')}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
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
                className={[
                  'flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors',
                  splitRule === rule
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-border bg-surface text-muted hover:border-accent/50',
                ].join(' ')}
              >
                {SPLIT_LABELS[rule]}
              </button>
            ))}
          </div>
          <input type="hidden" name="split_rule" value={splitRule} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Pagato da</span>
          <div className="flex gap-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaidBy(p.id)}
                disabled={pending || isSettled}
                className={[
                  'flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors',
                  paidBy === p.id
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-border bg-surface text-muted hover:border-accent/50',
                ].join(' ')}
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
          <p role="alert" className="text-sm text-destructive">{state.error}</p>
        )}

        {!isSettled && (
          <div className="flex flex-col gap-3 mt-1">
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
