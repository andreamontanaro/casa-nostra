'use client'

import { useState, useTransition } from 'react'
import { BellRing, FastForward, Pause, Play, Plus, Repeat, Trash2 } from 'lucide-react'
import type { SubscriptionFieldErrors, SubscriptionInput, SubscriptionView } from '@/lib/subscriptions/service'
import {
  deleteSubscriptionAction,
  saveSubscriptionAction,
  setNotifyHourAction,
  setSubscriptionActiveAction,
} from '@/app/actions/subscriptions'
import {
  INTERVAL_LABELS,
  INTERVAL_OPTIONS,
  REMINDER_DAYS_BEFORE,
  cadenceFromDate,
  cadenceLabel,
  daysBetween,
  isIsoDate,
  monthlyAmount,
  relativeDays,
} from '@/lib/subscriptions/schedule'
import { CATEGORY_LABELS, DEFAULT_SPLIT, formatDateShort, formatEur, splitLabel } from '@/lib/fmt'
import { parseEuroInput, previewExpenseShares } from '@/lib/expense-input'
import { Constants, type Tables } from '@/types/database'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { HeaderActions } from '@/components/HeaderActions'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Card } from '@/components/ui/Card'
import { ListRow } from '@/components/ui/ListRow'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Dialog } from '@/components/ui/Dialog'
import { AmountInput } from '@/components/ui/AmountInput'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { AnticipateChargeSheet } from '@/components/AnticipateChargeSheet'

type Profile = Tables<'profiles'>
type Category = (typeof Constants.public.Enums.expense_category)[number]
type SplitRule = (typeof Constants.public.Enums.split_rule)[number]

const SPLIT_SEGMENT_LABELS: Record<SplitRule, string> = {
  fifty_fifty: '50/50',
  sixty_forty: '60/40',
  custom: 'Personalizza',
  full_other: "Tutto a carico dell'altra persona",
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

interface Props {
  subscriptions: SubscriptionView[]
  notifyHour: number
  profiles: Profile[]
  currentUserId: string
  today: string
  telegramConfigured: boolean
}

export function AbbonamentiShell({ subscriptions, notifyHour, profiles, currentUserId, today, telegramConfigured }: Props) {
  // `sub: null` = nuovo abbonamento. `key` cambia a ogni apertura, così il
  // foglio riparte dai dati giusti ma chiudendosi resta montato e scivola giù.
  const [sheet, setSheet] = useState<{ open: boolean; sub: SubscriptionView | null; key: number }>({
    open: false,
    sub: null,
    key: 0,
  })
  const openSheet = (sub: SubscriptionView | null) => setSheet((s) => ({ open: true, sub, key: s.key + 1 }))
  // Il foglio dell'anticipo, aperto dal foglio di modifica (che intanto si chiude).
  const [anticipate, setAnticipate] = useState<{ open: boolean; sub: SubscriptionView | null; key: number }>({
    open: false,
    sub: null,
    key: 0,
  })
  const active = subscriptions.filter((s) => s.active)
  const monthly = active.reduce((sum, s) => sum + monthlyAmount(Number(s.amount), s.interval_months), 0)
  const nameOf = (id: string) => (id === currentUserId ? 'te' : profiles.find((p) => p.id === id)?.display_name ?? '?')
  const otherOf = (id: string) => profiles.find((p) => p.id !== id)?.display_name

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-24 lg:pb-8">
      <header className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 font-display text-3xl font-semibold tracking-tight">Abbonamenti</h1>
        <HeaderActions />
      </header>

      <p className="-mt-2 text-sm text-muted">
        Le spese che arrivano da sole, come Internet o lo streaming: il giorno dell’addebito si registrano
        nello storico e il gruppo Telegram lo sa. {REMINDER_DAYS_BEFORE} giorni prima arriva un promemoria.
      </p>

      {active.length > 0 && (
        <Card className="flex items-end justify-between gap-3 p-5">
          <div className="min-w-0">
            <p className="text-sm text-muted">Al mese, in tutto</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{formatEur(monthly)}</p>
          </div>
          <p className="shrink-0 text-sm text-muted">
            {active.length} {active.length === 1 ? 'attivo' : 'attivi'}
          </p>
        </Card>
      )}

      <NotifyHourCard notifyHour={notifyHour} telegramConfigured={telegramConfigured} />

      {subscriptions.length > 0 ? (
        <Card className="overflow-hidden py-1">
          {subscriptions.map((sub) => {
            const days = daysBetween(today, sub.nextDue)
            return (
              <ListRow
                key={sub.id}
                onClick={() => openSheet(sub)}
                className={cn(!sub.active && 'opacity-60')}
                leading={<CategoryIcon category={sub.category} />}
                title={sub.description}
                subtitle={
                  <>
                    {cadenceLabel(
                      { chargeDay: sub.charge_day, intervalMonths: sub.interval_months, startMonth: sub.start_month },
                      sub.nextDue,
                    )}{' '}
                    · {splitLabel(sub.split_rule, otherOf(sub.paid_by))} · paga {nameOf(sub.paid_by)}
                  </>
                }
                trailing={
                  <>
                    <p className="text-sm font-semibold tabular-nums">{formatEur(Number(sub.amount))}</p>
                    <p className="mt-1 text-xs text-muted">
                      {sub.active ? (days <= 7 ? relativeDays(days) : formatDateShort(sub.nextDue)) : 'Sospeso'}
                    </p>
                  </>
                }
              />
            )
          })}
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <Repeat className="size-8 text-muted" strokeWidth={1.6} aria-hidden />
          <p className="font-semibold">Nessun abbonamento</p>
          <p className="text-sm text-muted">Aggiungi Internet, l’affitto del box o lo streaming: al resto pensa l’app.</p>
        </Card>
      )}

      <Button onClick={() => openSheet(null)} className="self-stretch sm:self-end">
        <Plus className="size-5" aria-hidden />
        Nuovo abbonamento
      </Button>

      <SubscriptionSheet
        key={sheet.key}
        open={sheet.open}
        subscription={sheet.sub}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        profiles={profiles}
        currentUserId={currentUserId}
        today={today}
        notifyHour={notifyHour}
        onAnticipate={(sub) => {
          setSheet((s) => ({ ...s, open: false }))
          setAnticipate((a) => ({ open: true, sub, key: a.key + 1 }))
        }}
      />

      <AnticipateChargeSheet
        key={anticipate.key}
        open={anticipate.open}
        subscription={anticipate.sub}
        onClose={() => setAnticipate((a) => ({ ...a, open: false }))}
        today={today}
        userId={currentUserId}
        profiles={profiles}
      />
    </div>
  )
}

function NotifyHourCard({ notifyHour, telegramConfigured }: { notifyHour: number; telegramConfigured: boolean }) {
  const [hour, setHour] = useState(notifyHour)
  const [pending, startTransition] = useTransition()

  function change(value: number) {
    const previous = hour
    setHour(value)
    startTransition(async () => {
      const result = await setNotifyHourAction(value)
      if (result.error) {
        setHour(previous)
        toast.error(result.error)
      } else toast.success(`Addebiti e promemoria dalle ${hourLabel(value)}`)
    })
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent-muted text-accent-soft">
          <BellRing className="size-5" aria-hidden />
        </span>
        <label htmlFor="notify-hour" className="min-w-0 flex-1 text-sm font-medium">
          Ora di addebiti e promemoria
        </label>
        <select
          id="notify-hour"
          value={hour}
          disabled={pending}
          onChange={(e) => change(Number(e.target.value))}
          className="h-11 shrink-0 rounded-2xl border border-border bg-surface px-3 text-base font-semibold tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {hourLabel(h)}
            </option>
          ))}
        </select>
      </div>
      {!telegramConfigured && (
        <p className="text-xs text-muted">
          Telegram non è collegato: le spese si registrano comunque, ma senza avvisi né promemoria.
        </p>
      )}
    </Card>
  )
}

// ------------------------------------------------------------
// Inserimento e modifica
// ------------------------------------------------------------

interface SheetProps {
  open: boolean
  subscription: SubscriptionView | null
  onClose: () => void
  profiles: Profile[]
  currentUserId: string
  today: string
  notifyHour: number
  onAnticipate: (sub: SubscriptionView) => void
}

function SubscriptionSheet({ open, subscription, onClose, profiles, currentUserId, today, notifyHour, onAnticipate }: SheetProps) {
  const sub = subscription
  const [amount, setAmount] = useState(sub ? Number(sub.amount).toFixed(2).replace('.', ',') : '')
  const [description, setDescription] = useState(sub?.description ?? '')
  const [category, setCategory] = useState<Category>((sub?.category as Category) ?? 'abbonamento')
  const [splitRule, setSplitRule] = useState<SplitRule>((sub?.split_rule as SplitRule) ?? DEFAULT_SPLIT.abbonamento)
  const [splitTouched, setSplitTouched] = useState(Boolean(sub))
  const [customOtherShare, setCustomOtherShare] = useState(
    sub?.custom_other_share != null ? Number(sub.custom_other_share).toFixed(2).replace('.', ',') : '',
  )
  const [paidBy, setPaidBy] = useState(sub?.paid_by ?? currentUserId)
  const [intervalMonths, setIntervalMonths] = useState(String(sub?.interval_months ?? 1))
  const [nextDue, setNextDue] = useState(sub?.nextDue ?? '')
  const [fieldErrors, setFieldErrors] = useState<SubscriptionFieldErrors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  const otherProfile = profiles.find((p) => p.id !== paidBy)
  const chargedToLabel = !otherProfile
    ? SPLIT_SEGMENT_LABELS.full_other
    : otherProfile.id === currentUserId
      ? 'Tutto a mio carico'
      : `Tutto a carico di ${otherProfile.display_name}`
  const parsedAmount = parseEuroInput(amount) ?? NaN
  const parsedCustom = parseEuroInput(customOtherShare)
  const showShares =
    parsedAmount > 0 && (splitRule !== 'custom' || (parsedCustom !== null && parsedCustom < parsedAmount))
  const cadenceHint = isIsoDate(nextDue)
    ? `${cadenceLabel(cadenceFromDate(nextDue, Number(intervalMonths)), nextDue)}, alle ${hourLabel(notifyHour)}. ` +
      'Il 29, 30 e 31 nei mesi più corti diventano l’ultimo giorno del mese.'
    : 'Da questa data in poi, con la cadenza scelta.'

  function chooseCategory(next: Category) {
    setCategory(next)
    if (!splitTouched) setSplitRule(DEFAULT_SPLIT[next])
  }

  function save() {
    const input: SubscriptionInput = {
      amount,
      description,
      category,
      splitRule,
      customOtherShare,
      paidBy,
      nextDue,
      intervalMonths,
    }
    startTransition(async () => {
      const result = await saveSubscriptionAction(sub?.id ?? null, input)
      if (result.ok) {
        toast.success(sub ? 'Abbonamento aggiornato' : 'Abbonamento aggiunto')
        onClose()
        return
      }
      setFieldErrors(result.fieldErrors ?? {})
      if (result.error) toast.error(result.error)
    })
  }

  function toggleActive() {
    if (!sub) return
    startTransition(async () => {
      const result = await setSubscriptionActiveAction(sub.id, !sub.active)
      if (result.error) return void toast.error(result.error)
      toast.success(sub.active ? 'Abbonamento sospeso' : 'Abbonamento riattivato')
      onClose()
    })
  }

  function remove() {
    if (!sub) return
    startTransition(async () => {
      const result = await deleteSubscriptionAction(sub.id)
      if (result.error) return void toast.error(result.error)
      setConfirmDelete(false)
      toast.success('Abbonamento eliminato', { description: 'Le spese già registrate restano nello storico.' })
      onClose()
    })
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => !o && !pending && onClose()}
        title={sub ? 'Modifica abbonamento' : 'Nuovo abbonamento'}
        size="full"
        footer={
          <Button onClick={save} loading={pending} size="lg" className="w-full">
            {sub ? 'Salva modifiche' : 'Aggiungi abbonamento'}
          </Button>
        }
      >
        <div className="flex flex-col gap-5 px-4 pb-6">
          <AmountInput
            name="amount"
            value={amount}
            onChange={setAmount}
            disabled={pending}
            error={fieldErrors.amount}
            focusOnOpen={!sub}
            size="hero"
          />

          <Input
            label="Nome"
            name="description"
            placeholder="es. Internet casa"
            maxLength={80}
            disabled={pending}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={fieldErrors.description}
          />

          <div className="flex flex-col gap-2">
            <span className="text-label font-medium text-muted">Categoria</span>
            <div className="grid grid-cols-3 gap-2">
              {Constants.public.Enums.expense_category.map((cat) => {
                const isActive = category === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => chooseCategory(cat)}
                    disabled={pending}
                    aria-pressed={isActive}
                    className={cn(
                      'flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5',
                      'transition-[border-color,background-color,transform] duration-150 active:scale-[0.97] disabled:opacity-50',
                      isActive ? 'border-accent bg-accent-muted' : 'border-border bg-surface hover:border-accent/40',
                    )}
                  >
                    <CategoryIcon category={cat} size="sm" />
                    <span className={cn('w-full break-words text-center text-xs font-medium', isActive ? 'text-accent-soft' : 'text-muted')}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                  </button>
                )
              })}
            </div>
            {fieldErrors.category && <p className="text-xs text-destructive">{fieldErrors.category}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-label font-medium text-muted">Divisione</span>
            <SegmentedControl
              groupId="subscription-split"
              label="Divisione dell’abbonamento"
              disabled={pending}
              value={splitRule}
              onChange={(v) => {
                setSplitRule(v as SplitRule)
                setSplitTouched(true)
              }}
              className="grid grid-cols-3"
              options={Constants.public.Enums.split_rule.map((rule) => ({
                value: rule,
                label: rule === 'full_other' ? chargedToLabel : SPLIT_SEGMENT_LABELS[rule],
                className: rule === 'full_other' ? 'col-span-3' : undefined,
              }))}
            />
            {splitRule === 'custom' && (
              <AmountInput
                name="custom_other_share"
                id="subscription-custom-share"
                size="md"
                label={`Quota di ${otherProfile?.display_name ?? 'altra persona'}`}
                value={customOtherShare}
                onChange={setCustomOtherShare}
                disabled={pending}
                error={fieldErrors.customOtherShare}
              />
            )}
          </div>

          {showShares && (
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-accent-muted p-4" aria-live="polite" aria-label="Anteprima delle quote">
              {previewExpenseShares(parsedAmount, splitRule, paidBy, parsedCustom, profiles).map((person) => (
                <div key={person.id}>
                  <p className="break-words text-xs text-accent-soft">{person.id === currentUserId ? 'La tua quota' : person.display_name}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-accent-soft">{formatEur(person.share)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-label font-medium text-muted">Addebito su</span>
            <div className="flex gap-2">
              {profiles.map((p) => {
                const isActive = paidBy === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPaidBy(p.id)}
                    disabled={pending}
                    aria-pressed={isActive}
                    className={cn(
                      'flex min-w-0 flex-1 items-center justify-center break-words rounded-2xl border px-2 py-3 text-sm font-medium',
                      'transition-[border-color,background-color,color,transform] duration-150 active:scale-[0.97] disabled:opacity-50',
                      isActive ? 'border-accent bg-accent-muted text-accent-soft' : 'border-border bg-surface text-muted hover:border-accent/40',
                    )}
                  >
                    {p.id === currentUserId ? 'Io' : p.display_name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-label font-medium text-muted">Ogni quanto</span>
            <SegmentedControl
              groupId="subscription-interval"
              label="Frequenza dell’addebito"
              disabled={pending}
              value={intervalMonths}
              onChange={setIntervalMonths}
              className="grid grid-cols-3"
              options={INTERVAL_OPTIONS.map((n) => ({ value: String(n), label: INTERVAL_LABELS[n] }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="subscription-next-due" className="text-label font-medium text-muted">
              Prossimo addebito
            </label>
            <input
              id="subscription-next-due"
              type="date"
              min={today}
              value={nextDue}
              disabled={pending}
              onChange={(e) => setNextDue(e.target.value)}
              aria-invalid={Boolean(fieldErrors.nextDue) || undefined}
              className={cn(
                'h-12 w-full rounded-2xl border bg-surface px-4 text-base text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50',
                fieldErrors.nextDue ? 'border-destructive' : 'border-border',
              )}
            />
            {fieldErrors.nextDue ? (
              <p className="text-xs text-destructive">{fieldErrors.nextDue}</p>
            ) : (
              <p className="text-xs text-muted">{cadenceHint}</p>
            )}
          </div>

          {sub?.canAnticipate && (
            <div className="flex flex-col gap-2 rounded-2xl bg-accent-muted p-4">
              <p className="text-sm text-accent-soft">
                L’addebito arriva {relativeDays(daysBetween(today, sub.nextDue))}, il {formatDateShort(sub.nextDue)}. Puoi
                registrarlo già adesso: entra subito nel saldo e quel giorno non si ripete.
              </p>
              <Button variant="primary" size="sm" className="self-start" onClick={() => onAnticipate(sub)} disabled={pending}>
                <FastForward className="size-4" aria-hidden />
                Anticipa l’addebito
              </Button>
            </div>
          )}

          {sub && (
            <div className="flex flex-col gap-2 border-t border-border pt-5">
              {sub.lastChargedOn && (
                <p className="text-xs text-muted">
                  Ultimo addebito registrato: {formatDateShort(sub.lastChargedOn)}.
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={toggleActive} disabled={pending}>
                  {sub.active ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                  {sub.active ? 'Sospendi' : 'Riattiva'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-destructive"
                  onClick={() => setConfirmDelete(true)}
                  disabled={pending}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Elimina
                </Button>
              </div>
            </div>
          )}
        </div>
      </Sheet>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Eliminare l’abbonamento?"
        description="Non si registreranno più spese da questo abbonamento. Quelle già registrate restano nello storico."
        confirmLabel="Elimina"
        confirmVariant="destructive"
        onConfirm={remove}
        loading={pending}
      />
    </>
  )
}
