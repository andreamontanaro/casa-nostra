'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { createExpense, type ExpenseFormState } from '@/app/actions/expenses'
import { uploadAttachments } from '@/lib/attachments'
import { AttachmentUploader } from '@/components/AttachmentUploader'
import { ExpenseFormFields } from '@/components/expense/ExpenseFormFields'
import { ExpenseDraftNotice, saveDraft, clearDraft } from '@/components/expense/ExpenseDraftNotice'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/Button'
import { DEFAULT_SPLIT, todayISO } from '@/lib/fmt'
import { parseEuroInput } from '@/lib/expense-input'
import type { Tables } from '@/types/database'
import { Constants } from '@/types/database'
import type { ExpenseSuggestion } from '@/lib/queries'
import { cn } from '@/lib/utils'

type Profile = Tables<'profiles'>
type Category = (typeof Constants.public.Enums.expense_category)[number]
type SplitRule = (typeof Constants.public.Enums.split_rule)[number]
export interface ExpenseDraft {
  amount: string; description: string; category: Category; splitRule: SplitRule;
  paidBy: string; customOtherShare: string; expenseDate: string
}
interface Props {
  profiles: Profile[]; currentUserId: string; suggestions?: ExpenseSuggestion[]
  redirectTo?: string; onSuccess?: () => void; initialDraft?: Partial<ExpenseDraft>; sourceReceiptId?: string; onPendingChange?: (pending: boolean) => void
}
export function ExpenseForm({ profiles, currentUserId, suggestions = [], redirectTo, onSuccess, initialDraft, sourceReceiptId, onPendingChange }: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState<ExpenseDraft>({
    amount: '', description: '', category: 'spesa_alimentare', splitRule: 'sixty_forty',
    paidBy: currentUserId, customOtherShare: '', expenseDate: todayISO(), ...initialDraft,
  })
  const [touched, setTouched] = useState(Boolean(initialDraft))
  const [state, setState] = useState<ExpenseFormState>({})
  const [files, setFiles] = useState<File[]>([])
  const [savedId, setSavedId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const submitting = useRef(false)
  const isSheet = !redirectTo

  function change<K extends keyof ExpenseDraft>(key: K, value: ExpenseDraft[K]) {
    const next = { ...draft, [key]: value }
    setTouched(true); setDraft(next); saveDraft(currentUserId, next)
  }
  function categoryChange(category: Category) {
    const next = withCategory(draft, category)
    setTouched(true); setDraft(next); saveDraft(currentUserId, next)
  }
  // Un suggerimento è "come l'ultima volta": descrizione, categoria e divisione
  // insieme. Una divisione personalizzata non si ricopia (la quota cambia ogni
  // volta): resta il default della categoria.
  function pickSuggestion(suggestion: ExpenseSuggestion) {
    const next = withCategory({ ...draft, description: suggestion.description }, suggestion.category)
    if (suggestion.splitRule !== 'custom') next.splitRule = suggestion.splitRule
    setTouched(true); setDraft(next); saveDraft(currentUserId, next)
  }
  function restore(value: unknown) {
    if (!value || typeof value !== 'object') return
    const d = value as Record<string, unknown>
    if (typeof d.amount !== 'string' || typeof d.description !== 'string'
      || !Constants.public.Enums.expense_category.includes(d.category as Category)
      || !Constants.public.Enums.split_rule.includes(d.splitRule as SplitRule)
      || typeof d.paidBy !== 'string' || !profiles.some((p) => p.id === d.paidBy)
      || typeof d.customOtherShare !== 'string' || typeof d.expenseDate !== 'string') return
    setDraft(d as unknown as ExpenseDraft); setTouched(true)
  }
  const warningRef = useRef<string | undefined>(undefined)
  function finish() {
    clearDraft(currentUserId)
    if (warningRef.current) toast.warning(warningRef.current, { duration: 8000 })
    else toast.success('Spesa salvata.')
    onSuccess?.()
    // Niente router.refresh(): `createExpense` chiama già revalidatePath, e la
    // risposta della Server Action porta con sé la pagina aggiornata.
    if (redirectTo) router.push(redirectTo)
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const data = new FormData(event.currentTarget)
    const amount = parseEuroInput(draft.amount)
    const custom = parseEuroInput(draft.customOtherShare)
    const errors: Record<string, string> = {}
    if (amount === null) errors.amount = 'Usa un importo positivo, con al massimo due decimali.'
    if (!draft.description.trim()) errors.description = 'Scrivi a cosa si riferisce la spesa.'
    if (draft.splitRule === 'custom' && (custom === null || amount === null || custom >= amount)) errors.custom_other_share = 'La quota deve essere positiva e inferiore al totale.'
    if (Object.keys(errors).length) { setState({ fieldErrors: errors }); return }
    submitting.current = true
    onPendingChange?.(true)
    startTransition(async () => {
      try {
        let expenseId = savedId
        if (!expenseId) {
          const result = await createExpense({}, data)
          setState(result)
          if (!result.ok || !result.expenseId) return
          warningRef.current = result.warning
          expenseId = result.expenseId
          setSavedId(expenseId)
          clearDraft(currentUserId)
        }
        if (files.length) {
          const results = await uploadAttachments(expenseId, files, currentUserId)
          const remaining = files.filter((_, i) => !results[i]?.ok)
          setFiles(remaining)
          if (remaining.length) {
            setState({ error: 'La spesa è salvata. Alcuni allegati non sono stati caricati: riprova senza creare una seconda spesa.' })
            return
          }
        }
        finish()
      } catch (error) {
        if (isRedirectError(error)) throw error
        setState({ error: 'Non riesco a completare il salvataggio. I campi sono conservati: riprova.' })
      } finally { submitting.current = false; onPendingChange?.(false) }
    })
  }
  return (
    <form onSubmit={submit} className={cn('flex flex-col px-4 pt-4', isSheet ? 'pb-0' : 'pb-6')}>
      {!touched && <ExpenseDraftNotice userId={currentUserId} onRestore={restore} />}
      <ExpenseFormFields profiles={profiles} currentUserId={currentUserId} disabled={pending || Boolean(savedId)}
        fieldErrors={state.fieldErrors} suggestions={suggestions} onSuggestionPick={pickSuggestion} amountFocusOnOpen={isSheet}
        amount={draft.amount} onAmountChange={(v) => change('amount', v)}
        description={draft.description} onDescriptionChange={(v) => change('description', v)}
        category={draft.category} onCategoryChange={categoryChange}
        splitRule={draft.splitRule} onSplitRuleChange={(v) => change('splitRule', v)}
        customOtherShare={draft.customOtherShare} onCustomOtherShareChange={(v) => change('customOtherShare', v)}
        paidBy={draft.paidBy} onPaidByChange={(v) => change('paidBy', v)}
        expenseDate={draft.expenseDate} onExpenseDateChange={(v) => change('expenseDate', v)}
        attachmentsSlot={<details className="rounded-2xl border border-border p-4" open={files.length > 0 || undefined}>
          <summary className="min-h-11 text-sm font-semibold">Scontrini e allegati <span className="font-normal text-muted">(facoltativi)</span></summary>
          <AttachmentUploader mode="deferred" files={files} onFilesChange={setFiles} disabled={pending} />
        </details>}
      />
      {sourceReceiptId && <input type="hidden" name="source_receipt_id" value={sourceReceiptId} />}
      <input type="hidden" name="has_attachments" value={files.length ? '1' : '0'} />
      {state.existingExpenseId && <Link className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-accent-muted p-3 text-accent" href={`/spese/${state.existingExpenseId}`}>Controlla la spesa già presente</Link>}
      {state.error && <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">{state.error}</p>}
      <div className={cn('mt-5', isSheet && 'sticky bottom-0 z-10 -mx-4 border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,var(--safe-bottom))]')}>
        <Button type="submit" size="lg" loading={pending} className="w-full">{savedId ? 'Riprova caricamento allegati' : 'Salva spesa'}</Button>
        {savedId && <Button variant="ghost" className="mt-2 w-full" disabled={pending} onClick={finish}>Completa senza gli allegati mancanti</Button>}
      </div>
    </form>
  )
}

/**
 * Cambio di categoria: la divisione segue il default della nuova categoria
 * solo se era ancora quello della precedente (una scelta a mano resta), e
 * l'affitto propone importo e descrizione del mese se mancano.
 */
function withCategory(draft: ExpenseDraft, category: Category): ExpenseDraft {
  const next = { ...draft, category, splitRule: draft.splitRule === DEFAULT_SPLIT[draft.category] ? DEFAULT_SPLIT[category] : draft.splitRule }
  if (category === 'affitto') {
    if (!next.amount.trim()) next.amount = '530,00'
    if (!next.description.trim()) next.description = 'Affitto ' + new Date().toLocaleString('it-IT', { month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })
  }
  return next
}
