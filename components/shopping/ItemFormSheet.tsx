'use client'

import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Input } from '@/components/ui/Input'
import { Chip } from '@/components/ui/Chip'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import {
  SHOPPING_CATEGORY_ICON,
  SHOPPING_CATEGORY_LABELS,
  SHOPPING_URGENCY_LABELS,
} from '@/lib/fmt'
import { addItemAction, updateItemAction } from '@/app/actions/shopping'
import { toast } from '@/lib/toast'
import { Constants } from '@/types/database'
import type { ShoppingItem } from '@/lib/queries'

const CATEGORIES = Constants.public.Enums.shopping_category
const URGENCIES = Constants.public.Enums.shopping_urgency

interface ItemFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Articolo da modificare; assente = nuovo articolo. */
  item?: ShoppingItem | null
}

/**
 * Form di un articolo: nome grande in cima (come l'importo nel form spesa),
 * poi quantità, tipo di prodotto e urgenza. Il tipo di prodotto ha un
 * default ("cibo") e l'urgenza pure ("normale"): serve un solo campo per
 * aggiungere qualcosa alla lista, tutto il resto è facoltativo.
 */
export function ItemFormSheet({ open, onOpenChange, item }: ItemFormSheetProps) {
  const editing = !!item

  // I campi partono dai valori dell'articolo e non vengono risincronizzati da
  // un effetto: chi apre la sheet le cambia la `key` (vedi ShoppingShell), che
  // è il modo di React di ripartire da uno stato pulito senza effetti.
  const [name, setName] = useState(item?.name ?? '')
  const [quantity, setQuantity] = useState(item?.quantity ?? '')
  const [category, setCategory] = useState<string>(item?.category ?? 'cibo')
  const [urgency, setUrgency] = useState<string>(item?.urgency ?? 'media')
  const [note, setNote] = useState(item?.note ?? '')
  const [pending, setPending] = useState(false)

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Scrivi cosa serve.')
      return
    }

    setPending(true)
    const payload = { name: trimmed, category, quantity, urgency, note }
    const result = editing
      ? await updateItemAction(item!.id, payload)
      : await addItemAction(payload)
    setPending(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(editing ? 'Aggiornato.' : `"${trimmed}" aggiunto alla lista.`)
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Modifica articolo' : 'Cosa serve?'}
      size="auto"
      footer={
        <Button className="w-full" size="lg" onClick={handleSubmit} loading={pending}>
          {editing ? 'Salva' : 'Aggiungi alla lista'}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 px-4 pb-4 pt-1">
        <Input
          label="Prodotto"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Latte parzialmente scremato"
          // Il fuoco lo dà la Sheet a fine animazione: vedi components/ui/Sheet.tsx
          data-autofocus={editing ? undefined : ''}
          enterKeyHint="done"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
        />

        <Input
          label="Quantità (facoltativa)"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="2 confezioni"
        />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Tipo di prodotto</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                {SHOPPING_CATEGORY_ICON[c]} {SHOPPING_CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Urgenza</span>
          <SegmentedControl
            groupId="shopping-urgency"
            value={urgency}
            onChange={setUrgency}
            options={URGENCIES.map((u) => ({ value: u, label: SHOPPING_URGENCY_LABELS[u] }))}
          />
        </div>

        <Input
          label="Nota (facoltativa)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Quella senza lattosio"
        />
      </div>
    </Sheet>
  )
}
