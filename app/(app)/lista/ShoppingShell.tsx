'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, ScanLine, ShoppingBasket } from 'lucide-react'
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
  addQuickItemAction,
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
 * senza conferma, con "Annulla" nel toast,
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
  const [quickName, setQuickName] = useState('')
  const [quickPending, setQuickPending] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ShoppingItem | null>(null)
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
  // di altre liste interattive).
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
    const result = await markBoughtAction(item.id).catch(() => ({ error: 'Connessione interrotta. Riprova tra un momento.' }))
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
          const undo = await restoreItemAction(item.id).catch(() => ({ error: 'Connessione interrotta. Riprova tra un momento.' }))
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
    const result = await restoreItemAction(item.id).catch(() => ({ error: 'Connessione interrotta. Riprova tra un momento.' }))
    markPending(item.id, false)
    if (result.error) toast.error(result.error)
    else toast.success(`"${item.name}" è di nuovo in lista.`)
  }

  async function handleDelete(item: ShoppingItem) {
    markPending(item.id, true)
    const result = await deleteItemAction(item.id).catch(() => ({ error: 'Connessione interrotta. Riprova tra un momento.' }))
    markPending(item.id, false)
    if (result.error) toast.error(result.error)
    else toast.success('Eliminato.')
  }

  async function handleClearBought() {
    setClearing(true)
    const result = await clearBoughtAction().catch(() => ({ error: 'Non riesco a svuotare lo storico. Riprova.' }))
    setClearing(false)
    setConfirmClear(false)
    if (result.error) toast.error(result.error)
    else toast.success('Storico svuotato.')
  }

  /**
   * Barra rapida: si scrive una riga sola ("x2 mele") e nome, quantità e
   * categoria li ricava il modello lato server — con ripiego sulla riga così
   * com'è scritta, in "cibo", se non risponde. Il toast dice cos'ha capito
   * — «"mele" (2) aggiunto a 🍎 Cibo» — perché campi compilati da altri vanno
   * mostrati: se ha sbagliato, la riga è lì sotto a un tap.
   */
  async function quickAdd(event: React.FormEvent) {
    event.preventDefault()
    const text = quickName.trim()
    if (!text || quickPending) return
    setQuickPending(true)
    try {
      const result = await addQuickItemAction(text).catch(() => ({ error: 'Connessione interrotta. Riprova tra un momento.', reading: undefined }))
      if (result.error) toast.error(result.error)
      else {
        setQuickName('')
        const reading = result.reading
        toast.success(
          reading
            ? `"${reading.name}"${reading.quantity ? ` (${reading.quantity})` : ''} aggiunto a ${SHOPPING_CATEGORY_ICON[reading.category]} ${SHOPPING_CATEGORY_LABELS[reading.category]}.`
            : 'Aggiunto alla lista.',
        )
      }
    } catch { toast.error('Non riesco ad aggiungere il prodotto. Il nome è conservato.') }
    finally { setQuickPending(false) }
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
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h1 className="font-display text-3xl font-semibold text-foreground">La vostra lista</h1>
        <span className="text-sm text-muted">
          {visibleItems.length === 0
            ? 'Non manca niente'
            : `${visibleItems.length} ${visibleItems.length === 1 ? 'articolo' : 'articoli'}`}
        </span>
      </header>

      <form onSubmit={quickAdd} className="flex items-center gap-2 rounded-3xl border border-border bg-surface p-2">
        <input aria-label="Prodotto da aggiungere" placeholder="Cosa serve? Es. x2 mele" value={quickName} onChange={(e) => setQuickName(e.target.value)} disabled={quickPending}
          className="min-h-12 min-w-0 flex-1 rounded-2xl bg-transparent px-3 text-base" enterKeyHint="done" />
        <Button type="submit" aria-label="Aggiungi prodotto" disabled={!quickName.trim()} loading={quickPending} className="shrink-0 px-4"><Plus className="size-5" aria-hidden /></Button>
      </form>

      {missingSinceCheck.length > 0 && lastCheck && (
        <Card className="flex flex-col gap-2 border-border bg-accent-muted/50 px-4 py-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShoppingBasket className="size-4 text-accent" />
            Da prendere la prossima volta
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
                        className={cn(missingIds.has(item.id) && 'bg-accent-muted/30')}
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
                          onDelete={() => setDeleteTarget(item)}
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
        <details className="rounded-3xl border border-border bg-surface p-4"><summary className="min-h-11 font-semibold">Comprati di recente ({boughtItems.length})</summary>
        <section className="mt-3">
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
                onDelete={() => setDeleteTarget(item)}
              />
            ))}
          </Card>
        </section>
        </details>
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
          'fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] app-fab z-30 hide-on-keyboard',
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

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}
        title="Eliminare questo articolo?" description={deleteTarget ? `“${deleteTarget.name}” verrà eliminato dalla lista.` : ''}
        confirmLabel="Elimina" confirmVariant="destructive"
        loading={deleteTarget ? pendingIds.has(deleteTarget.id) : false}
        onConfirm={async () => {
          if (!deleteTarget) return
          try { await handleDelete(deleteTarget) } catch { toast.error('Non riesco a eliminare l’articolo. Riprova.') }
          finally { setDeleteTarget(null) }
        }} />

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
