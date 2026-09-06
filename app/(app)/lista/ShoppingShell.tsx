'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, ScanLine, AlertTriangle } from 'lucide-react'
import { ItemFormSheet } from '@/components/shopping/ItemFormSheet'
import { ReceiptCheckSheet } from '@/components/shopping/ReceiptCheckSheet'
import { ShoppingItemRow } from '@/components/shopping/ShoppingItemRow'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Dialog } from '@/components/ui/Dialog'
import {
  SHOPPING_CATEGORY_ICON,
  SHOPPING_CATEGORY_LABELS,
  SHOPPING_CATEGORY_ORDER,
  formatBoughtWhen,
  formatDate,
} from '@/lib/fmt'
import { springSnappy } from '@/lib/motion'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  clearBoughtAction,
  deleteItemAction,
  markBoughtAction,
  restoreItemAction,
} from '@/app/actions/shopping'
import type { ShoppingItem, ShoppingLastCheck, ShoppingMissingItem } from '@/lib/queries'

interface ShoppingShellProps {
  openItems: ShoppingItem[]
  boughtItems: ShoppingItem[]
  lastCheck: ShoppingLastCheck | null
  missingSinceCheck: ShoppingMissingItem[]
}

/**
 * Schermata della lista della spesa. Un tap sul checkbox spunta l'articolo
 * senza conferma (con "Annulla" nel toast, come il "Fatto" delle faccende),
 * il resto della riga apre la modifica. In cima, quando c'è, la card di
 * quello che è rimasto fuori dall'ultimo scontrino: è l'unica cosa che
 * merita di stare sopra la lista, perché è l'unica che si scorda.
 */
export function ShoppingShell({
  openItems,
  boughtItems,
  lastCheck,
  missingSinceCheck,
}: ShoppingShellProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ShoppingItem | null>(null)
  // Cambia a ogni apertura: rimonta il form della sheet con i campi giusti
  // (nuovo articolo o articolo scelto) senza sincronizzarli con un effetto.
  const [formKey, setFormKey] = useState(0)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [hiddenBaseKey, setHiddenBaseKey] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('tutte')
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)

  // Gli id nascosti in ottimistica valgono solo finché i dati del server sono
  // quelli su cui la scelta è stata fatta: appena la rotta si rivalida, la
  // verità torna a essere la lista che arriva dal server (stesso meccanismo
  // di ChoreShell).
  const itemsKey = openItems.map((i) => i.id).join('|')
  const visibleHidden = hiddenBaseKey === itemsKey ? hiddenIds : new Set<string>()

  const visibleItems = openItems.filter((i) => !visibleHidden.has(i.id))
  const missingIds = new Set(missingSinceCheck.map((m) => m.id).filter(Boolean) as string[])

  const presentCategories = SHOPPING_CATEGORY_ORDER.filter((c) =>
    visibleItems.some((i) => i.category === c),
  )
  const filtered =
    categoryFilter === 'tutte'
      ? visibleItems
      : visibleItems.filter((i) => i.category === categoryFilter)

  const grouped = SHOPPING_CATEGORY_ORDER.map(
    (category) => [category, filtered.filter((i) => i.category === category)] as const,
  ).filter(([, items]) => items.length > 0)

  function markPending(id: string, on: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function handleToggle(item: ShoppingItem) {
    markPending(item.id, true)
    const result = await markBoughtAction(item.id)
    markPending(item.id, false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    setHiddenBaseKey(itemsKey)
    setHiddenIds((prev) => new Set(prev).add(item.id))

    toast.success(`"${item.name}" comprato.`, {
      action: {
        label: 'Annulla',
        onClick: async () => {
          const undo = await restoreItemAction(item.id)
          if (undo.error) {
            toast.error(undo.error)
            return
          }
          setHiddenIds((prev) => {
            const next = new Set(prev)
            next.delete(item.id)
            return next
          })
        },
      },
    })
  }

  async function handleRestore(item: ShoppingItem) {
    markPending(item.id, true)
    const result = await restoreItemAction(item.id)
    markPending(item.id, false)
    if (result.error) toast.error(result.error)
    else toast.success(`"${item.name}" è di nuovo in lista.`)
  }

  async function handleDelete(item: ShoppingItem) {
    markPending(item.id, true)
    const result = await deleteItemAction(item.id)
    markPending(item.id, false)
    if (result.error) toast.error(result.error)
    else toast.success('Eliminato.')
  }

  async function handleClearBought() {
    setClearing(true)
    const result = await clearBoughtAction()
    setClearing(false)
    setConfirmClear(false)
    if (result.error) toast.error(result.error)
    else toast.success('Storico svuotato.')
  }

  function openNew() {
    setEditing(null)
    setFormKey((k) => k + 1)
    setFormOpen(true)
  }

  function openEdit(item: ShoppingItem) {
    setEditing(item)
    setFormKey((k) => k + 1)
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-24">
      <header className="flex items-baseline justify-between px-1">
        <h1 className="text-title font-semibold text-foreground">Lista della spesa</h1>
        <span className="text-sm text-muted">
          {visibleItems.length === 0
            ? 'Non manca niente'
            : `${visibleItems.length} ${visibleItems.length === 1 ? 'articolo' : 'articoli'}`}
        </span>
      </header>

      {missingSinceCheck.length > 0 && lastCheck && (
        <Card className="flex flex-col gap-2 border-destructive/30 px-4 py-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="size-4 text-destructive" />
            Rimasto fuori dall&apos;ultimo scontrino
          </span>
          <p className="text-xs text-muted">
            {lastCheck.checked_at ? formatDate(lastCheck.checked_at) : ''}
            {lastCheck.store_name ? ` · ${lastCheck.store_name}` : ''} — {missingSinceCheck.length}{' '}
            {missingSinceCheck.length === 1 ? 'cosa non comprata' : 'cose non comprate'}
          </p>
          <p className="text-sm text-foreground">
            {missingSinceCheck.map((m) => m.name).filter(Boolean).join(', ')}
          </p>
        </Card>
      )}

      <Button variant="outline" size="md" onClick={() => setReceiptOpen(true)}>
        <ScanLine className="size-5" />
        Controlla uno scontrino
      </Button>

      {presentCategories.length > 1 && (
        <div
          className="-mx-4 overflow-x-auto no-scrollbar"
          style={{ touchAction: 'pan-x', overscrollBehaviorX: 'contain' }}
        >
          <div className="flex items-center gap-2 px-4">
            <Chip
              variant="filter"
              active={categoryFilter === 'tutte'}
              onClick={() => setCategoryFilter('tutte')}
            >
              Tutto
            </Chip>
            {presentCategories.map((c) => (
              <Chip
                key={c}
                variant="filter"
                active={categoryFilter === c}
                onClick={() => setCategoryFilter(c)}
              >
                {SHOPPING_CATEGORY_ICON[c]} {SHOPPING_CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {grouped.length === 0 ? (
        <Card>
          <p className="px-4 py-10 text-center text-sm text-muted">
            {visibleItems.length === 0
              ? 'La lista è vuota. Quando finisce qualcosa, aggiungila qui.'
              : 'Niente in questa categoria.'}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {grouped.map(([category, items]) => (
            <section key={category}>
              <Card className="overflow-hidden p-0">
                <div className="flex items-center gap-2 border-b border-border bg-surface-sunken/60 px-4 py-2">
                  <span aria-hidden>{SHOPPING_CATEGORY_ICON[category]}</span>
                  <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    {SHOPPING_CATEGORY_LABELS[category]}
                  </span>
                  <span className="text-xs text-muted">{items.length}</span>
                </div>
                <div className="divide-y divide-border">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.div
                        key={item.id}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cn(missingIds.has(item.id) && 'bg-destructive/5')}
                      >
                        <ShoppingItemRow
                          name={item.name}
                          category={item.category}
                          quantity={item.quantity}
                          note={item.note}
                          urgency={item.urgency}
                          subtitle={
                            missingIds.has(item.id) ? 'non c\'era sull\'ultimo scontrino' : undefined
                          }
                          pending={pendingIds.has(item.id)}
                          onToggle={() => handleToggle(item)}
                          onEdit={() => openEdit(item)}
                          onDelete={() => handleDelete(item)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </Card>
            </section>
          ))}
        </div>
      )}

      {boughtItems.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-label font-semibold uppercase tracking-wide text-muted">
              🛍️ Comprati di recente
            </h2>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="text-xs font-medium text-muted underline-offset-4 hover:underline"
            >
              Svuota
            </button>
          </div>
          <Card className="divide-y divide-border overflow-hidden p-0">
            {boughtItems.map((item) => (
              <ShoppingItemRow
                key={item.id}
                name={item.name}
                category={item.category}
                quantity={item.quantity}
                bought
                subtitle={[
                  formatBoughtWhen(item.bought_at),
                  item.bought_via === 'scontrino'
                    ? 'da scontrino'
                    : (item.bought_by_profile?.display_name ?? ''),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                pending={pendingIds.has(item.id)}
                onRestore={() => handleRestore(item)}
                onDelete={() => handleDelete(item)}
              />
            ))}
          </Card>
        </section>
      )}

      <motion.button
        type="button"
        onClick={openNew}
        aria-label="Aggiungi alla lista"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...springSnappy, delay: 0.1 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.9 }}
        className={cn(
          'fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 hide-on-keyboard',
          'flex size-14 items-center justify-center rounded-full',
          'bg-accent text-accent-foreground shadow-fab',
        )}
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </motion.button>

      <ItemFormSheet
        key={formKey}
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editing}
      />

      <ReceiptCheckSheet open={receiptOpen} onOpenChange={setReceiptOpen} />

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Svuotare lo storico?"
        description="Gli articoli già comprati vengono eliminati definitivamente. La lista di quello che manca non viene toccata."
        confirmLabel="Svuota"
        confirmVariant="destructive"
        onConfirm={handleClearBought}
        loading={clearing}
      />
    </div>
  )
}
