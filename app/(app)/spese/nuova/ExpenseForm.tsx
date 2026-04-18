'use client'

import { useActionState } from 'react'
import { createExpense, type ExpenseFormState } from '@/app/actions/expenses'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CATEGORY_LABELS, SPLIT_LABELS, todayISO } from '@/lib/fmt'
import { Tables, Constants } from '@/types/database'
import { useState } from 'react'

type Profile = Tables<'profiles'>
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

interface ExpenseFormProps {
  profiles: Profile[]
  currentUserId: string
}

export function ExpenseForm({ profiles, currentUserId }: ExpenseFormProps) {
  const [state, action, pending] = useActionState<ExpenseFormState, FormData>(
    createExpense,
    {}
  )

  const [category, setCategory] = useState<Category>('altro')
  const [splitRule, setSplitRule] = useState<SplitRule>('sixty_forty')
  const [paidBy, setPaidBy] = useState(currentUserId)

  function handleCategoryChange(cat: Category) {
    setCategory(cat)
    setSplitRule(DEFAULT_SPLIT[cat])
  }

  return (
    <form action={action} className="flex flex-col gap-5 px-4 pt-4 pb-6">
      {/* Importo */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Importo (€)</label>
        <input
          name="amount"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          required
          disabled={pending}
          className="h-14 w-full rounded-xl border border-border bg-surface px-4 text-2xl font-semibold text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50"
        />
        {state.fieldErrors?.amount && (
          <p className="text-xs text-destructive">{state.fieldErrors.amount}</p>
        )}
      </div>

      {/* Descrizione */}
      <Input
        label="Descrizione"
        name="description"
        placeholder="es. Coop settimana"
        required
        disabled={pending}
        error={state.fieldErrors?.description}
      />

      {/* Categoria */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Categoria</span>
        <div className="flex flex-wrap gap-2">
          {Constants.public.Enums.expense_category.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryChange(cat)}
              disabled={pending}
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

      {/* Regola divisione */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Divisione</span>
        <div className="flex gap-2">
          {Constants.public.Enums.split_rule.map((rule) => (
            <button
              key={rule}
              type="button"
              onClick={() => setSplitRule(rule)}
              disabled={pending}
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

      {/* Pagato da */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Pagato da</span>
        <div className="flex gap-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPaidBy(p.id)}
              disabled={pending}
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

      {/* Data */}
      <Input
        label="Data"
        name="expense_date"
        type="date"
        defaultValue={todayISO()}
        required
        disabled={pending}
      />

      {state.error && (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        Salva spesa
      </Button>
    </form>
  )
}
