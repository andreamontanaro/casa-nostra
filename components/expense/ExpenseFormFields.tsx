'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { ExpenseFormState } from '@/app/actions/expenses'
import { AmountInput } from '@/components/ui/AmountInput'
import { Input } from '@/components/ui/Input'
import { Chip } from '@/components/ui/Chip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { CategoryIcon } from '@/components/CategoryIcon'
import { CATEGORY_LABELS, formatEur, todayISO } from '@/lib/fmt'
import { Tables, Constants } from '@/types/database'
import { cn } from '@/lib/utils'

type Profile = Tables<'profiles'>
type Category = (typeof Constants.public.Enums.expense_category)[number]
type SplitRule = (typeof Constants.public.Enums.split_rule)[number]

// Etichette compatte per il SegmentedControl divisione (SPLIT_LABELS.custom
// = "Personalizzato" è troppo lungo per un segmento).
const SPLIT_SEGMENT_LABELS: Record<SplitRule, string> = {
  fifty_fifty: '50/50',
  sixty_forty: '60/40',
  custom: 'Custom',
}

function isoOffsetFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export interface ExpenseFormFieldsProps {
  profiles: Profile[]
  currentUserId: string
  disabled?: boolean
  fieldErrors?: ExpenseFormState['fieldErrors']
  // Suggerimenti descrizione (solo in creazione).
  suggestions?: string[]
  descriptionRef?: React.Ref<HTMLInputElement>
  // Importo da mettere a fuoco all'apertura della sheet (il fuoco lo dà la
  // Sheet a fine animazione, vedi components/ui/Sheet.tsx).
  amountFocusOnOpen?: boolean
  // Slot allegati: differisce tra creazione (deferred) e modifica (immediate).
  attachmentsSlot?: React.ReactNode

  amount: string
  onAmountChange: (v: string) => void
  description: string
  onDescriptionChange: (v: string) => void
  category: Category
  onCategoryChange: (c: Category) => void
  splitRule: SplitRule
  onSplitRuleChange: (s: SplitRule) => void
  customOtherShare: string
  onCustomOtherShareChange: (v: string) => void
  paidBy: string
  onPaidByChange: (id: string) => void
  expenseDate: string
  onExpenseDateChange: (v: string) => void
}

export function ExpenseFormFields({
  profiles,
  currentUserId,
  disabled = false,
  fieldErrors,
  suggestions = [],
  descriptionRef,
  amountFocusOnOpen = false,
  attachmentsSlot,
  amount,
  onAmountChange,
  description,
  onDescriptionChange,
  category,
  onCategoryChange,
  splitRule,
  onSplitRuleChange,
  customOtherShare,
  onCustomOtherShareChange,
  paidBy,
  onPaidByChange,
  expenseDate,
  onExpenseDateChange,
}: ExpenseFormFieldsProps) {
  const otherProfile = profiles.find((p) => p.id !== paidBy)
  const parsedAmount = parseFloat(amount.replace(',', '.'))
  const parsedCustomShare = parseFloat(customOtherShare.replace(',', '.'))
  const showCustomPreview =
    splitRule === 'custom' &&
    !isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    !isNaN(parsedCustomShare) &&
    parsedCustomShare > 0 &&
    parsedCustomShare < parsedAmount

  return (
    <div className="flex flex-col gap-5">
      {/* Importo — hero amount-first */}
      <AmountInput
        name="amount"
        value={amount}
        onChange={onAmountChange}
        disabled={disabled}
        error={fieldErrors?.amount}
        focusOnOpen={amountFocusOnOpen}
        size="hero"
      />

      {/* Descrizione + suggerimenti */}
      <div className="flex flex-col gap-2">
        <Input
          ref={descriptionRef}
          label="Descrizione"
          name="description"
          placeholder="es. Coop settimana"
          required
          disabled={disabled}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          error={fieldErrors?.description}
        />
        {suggestions.length > 0 && (
          <div className="-mx-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 px-4">
              {suggestions.map((s) => (
                <Chip
                  key={s}
                  variant="suggestion"
                  disabled={disabled}
                  onClick={() => onDescriptionChange(s)}
                  className="text-xs"
                >
                  {s}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Categoria — riga scroll di CategoryIcon + label */}
      <div className="flex flex-col gap-2">
        <span className="text-label font-medium text-muted">Categoria</span>
        <div className="-mx-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 px-4">
            {Constants.public.Enums.expense_category.map((cat) => {
              const isActive = category === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onCategoryChange(cat)}
                  disabled={disabled}
                  aria-pressed={isActive}
                  className={cn(
                    'flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5',
                    'transition-[border-color,background-color,transform] duration-150 active:scale-[0.97]',
                    'disabled:opacity-50',
                    isActive
                      ? 'border-accent bg-accent-muted'
                      : 'border-border bg-surface hover:border-accent/40',
                  )}
                >
                  <CategoryIcon category={cat} size="sm" />
                  <span
                    className={cn(
                      'w-full truncate text-center text-xs font-medium',
                      isActive ? 'text-accent-soft' : 'text-muted',
                    )}
                  >
                    {CATEGORY_LABELS[cat]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <input type="hidden" name="category" value={category} />
      </div>

      {/* Divisione */}
      <div className="flex flex-col gap-2">
        <span className="text-label font-medium text-muted">Divisione</span>
        <SegmentedControl
          groupId="expense-split"
          value={splitRule}
          onChange={(v) => onSplitRuleChange(v as SplitRule)}
          options={Constants.public.Enums.split_rule.map((rule) => ({
            value: rule,
            label: SPLIT_SEGMENT_LABELS[rule],
          }))}
        />
        <input type="hidden" name="split_rule" value={splitRule} />
      </div>

      {/* Quota personalizzata — comparsa animata */}
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
            <AmountInput
              name="custom_other_share"
              size="md"
              label={`Quota di ${otherProfile?.display_name ?? 'altra persona'}`}
              value={customOtherShare}
              onChange={onCustomOtherShareChange}
              disabled={disabled}
              error={fieldErrors?.custom_other_share}
            />
            {showCustomPreview && (
              <p className="mt-1.5 text-xs tabular-nums text-muted">
                La tua quota: {formatEur(parsedAmount - parsedCustomShare)}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {splitRule !== 'custom' && (
        <input type="hidden" name="custom_other_share" value="" />
      )}

      {/* Pagato da */}
      <div className="flex flex-col gap-2">
        <span className="text-label font-medium text-muted">Pagato da</span>
        <div className="flex gap-2">
          {profiles.map((p) => {
            const isActive = paidBy === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPaidByChange(p.id)}
                disabled={disabled}
                aria-pressed={isActive}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-medium',
                  'transition-[border-color,background-color,color,transform] duration-150 active:scale-[0.97]',
                  'disabled:opacity-50',
                  isActive
                    ? 'border-accent bg-accent-muted text-accent-soft'
                    : 'border-border bg-surface text-muted hover:border-accent/40',
                )}
              >
                {p.id === currentUserId ? 'Io' : p.display_name}
              </button>
            )
          })}
        </div>
        <input type="hidden" name="paid_by" value={paidBy} />
      </div>

      {/* Data */}
      <DateField value={expenseDate} onChange={onExpenseDateChange} disabled={disabled} />

      {/* Allegati (slot) */}
      {attachmentsSlot}
    </div>
  )
}

// Data con chip rapide "Oggi · Ieri · Altra data" e fallback input nativo.
function DateField({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const today = todayISO()
  const yesterday = isoOffsetFromToday(-1)
  const isPreset = value === today || value === yesterday
  const [customOpen, setCustomOpen] = useState(!isPreset)

  const mode: 'oggi' | 'ieri' | 'altra' = customOpen
    ? 'altra'
    : value === today
      ? 'oggi'
      : value === yesterday
        ? 'ieri'
        : 'altra'

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label font-medium text-muted">Data</span>
      <div className="flex gap-2">
        <Chip
          variant="filter"
          active={mode === 'oggi'}
          disabled={disabled}
          onClick={() => {
            setCustomOpen(false)
            onChange(today)
          }}
        >
          Oggi
        </Chip>
        <Chip
          variant="filter"
          active={mode === 'ieri'}
          disabled={disabled}
          onClick={() => {
            setCustomOpen(false)
            onChange(yesterday)
          }}
        >
          Ieri
        </Chip>
        <Chip
          variant="filter"
          active={mode === 'altra'}
          disabled={disabled}
          onClick={() => setCustomOpen(true)}
        >
          Altra data
        </Chip>
      </div>
      {mode === 'altra' && (
        <input
          type="date"
          aria-label="Data spesa"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base text-foreground',
            'shadow-soft focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
            'disabled:opacity-50',
          )}
        />
      )}
      {/* Valore effettivo inviato con la form */}
      <input type="hidden" name="expense_date" value={value} />
    </div>
  )
}
