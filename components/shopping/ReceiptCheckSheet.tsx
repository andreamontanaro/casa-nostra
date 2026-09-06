'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Check, ShoppingBasket } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { createClient } from '@/lib/supabase/browser'
import { checkReceiptAction } from '@/app/actions/shopping'
import {
  ACCEPTED_RECEIPT_MIME,
  RECEIPTS_BUCKET,
  buildReceiptPath,
  validateReceiptFile,
} from '@/lib/shopping/receipts'
import { formatEur } from '@/lib/fmt'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

type CheckResult = Awaited<ReturnType<typeof checkReceiptAction>>

interface ReceiptCheckSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Controllo scontrino dall'app. La foto viene caricata dal browser
 * direttamente su Storage e poi la Server Action la rilegge da lì: il corpo
 * di una Server Action è limitato a 1 MB, che una foto di scontrino supera
 * quasi sempre (stesso motivo per cui gli allegati delle spese si caricano
 * lato client).
 */
export function ReceiptCheckSheet({ open, onOpenChange }: ReceiptCheckSheetProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [phase, setPhase] = useState<'idle' | 'working'>('idle')
  const [result, setResult] = useState<CheckResult | null>(null)

  function close(next: boolean) {
    if (phase === 'working') return
    if (!next) {
      setResult(null)
      router.refresh()
    }
    onOpenChange(next)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permette di riprovare con lo stesso file
    if (!file) return

    const invalid = validateReceiptFile(file)
    if (invalid) {
      toast.error(invalid)
      return
    }

    setPhase('working')
    setResult(null)

    const supabase = createClient()
    const path = buildReceiptPath(file.type)
    const { error: uploadError } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      setPhase('idle')
      toast.error('Non sono riuscito a caricare la foto. Riprova.')
      return
    }

    const outcome = await checkReceiptAction({
      storagePath: path,
      fileName: file.name,
      mimeType: file.type,
    })

    setPhase('idle')
    setResult(outcome)

    if (!outcome.ok) {
      toast.error(outcome.error)
      return
    }
    router.refresh()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title="Controllo scontrino"
      description="Fotografo, leggo e spunto: quello che resta è quello che manca ancora."
      size="auto"
      footer={
        result?.ok ? (
          <Button className="w-full" size="lg" variant="outline" onClick={() => close(false)}>
            Chiudi
          </Button>
        ) : (
          <Button
            className="w-full"
            size="lg"
            onClick={() => inputRef.current?.click()}
            loading={phase === 'working'}
          >
            <Camera className="size-5" />
            Scegli o scatta la foto
          </Button>
        )
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_RECEIPT_MIME.join(',')}
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex flex-col gap-4 px-4 pb-4 pt-1">
        {phase === 'working' && (
          <Card className="flex items-center gap-3 px-4 py-6">
            <Spinner size="sm" />
            <span className="text-sm text-muted">
              Sto leggendo lo scontrino e lo confronto con la lista…
            </span>
          </Card>
        )}

        {!result && phase === 'idle' && (
          <p className="text-sm text-muted">
            Inquadra tutto lo scontrino, dritto e con buona luce: i nomi dei prodotti sono
            abbreviati e una foto storta si legge male. Funzionano anche i PDF.
          </p>
        )}

        {result && !result.ok && (
          <Card className="px-4 py-4">
            <p className="text-sm text-destructive">{result.error}</p>
          </Card>
        )}

        {result?.ok && (
          <>
            <Card className="flex flex-col gap-1 px-4 py-4">
              <span className="text-sm font-semibold text-foreground">
                {result.storeName ?? 'Scontrino controllato'}
              </span>
              <span className="text-xs text-muted">
                {result.matched.length} spuntati · {result.missing.length} ancora da comprare
                {result.receiptTotal !== null ? ` · totale ${formatEur(result.receiptTotal)}` : ''}
              </span>
            </Card>

            <ResultGroup
              title="Spuntati dalla lista"
              icon={<Check className="size-4 text-positive" />}
              empty="Nessun articolo della lista riconosciuto sullo scontrino."
              items={result.matched.map((m) => ({ key: m.id, label: m.name, hint: m.receiptLine }))}
              strike
            />

            <ResultGroup
              title="Manca ancora"
              icon={<ShoppingBasket className="size-4 text-muted" />}
              empty="Niente: avete preso tutto quello che era in lista. 🎉"
              items={result.missing.map((m) => ({
                key: m.id,
                label: m.name,
                hint: m.quantity ?? undefined,
              }))}
            />

            {result.extraLines.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="px-1 text-label font-semibold uppercase tracking-wide text-muted">
                  Sullo scontrino ma non in lista
                </span>
                <p className="px-1 text-xs text-muted">{result.extraLines.join(' · ')}</p>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}

function ResultGroup({
  title,
  icon,
  items,
  empty,
  strike = false,
}: {
  title: string
  icon: React.ReactNode
  items: { key: string; label: string; hint?: string }[]
  empty: string
  strike?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 px-1 text-label font-semibold uppercase tracking-wide text-muted">
        {icon}
        {title}
      </span>
      {items.length === 0 ? (
        <p className="px-1 text-sm text-muted">{empty}</p>
      ) : (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {items.map((item) => (
            <div key={item.key} className="flex items-baseline gap-2 px-4 py-2.5">
              <span
                className={cn(
                  'text-sm text-foreground',
                  strike && 'line-through text-muted',
                )}
              >
                {item.label}
              </span>
              {item.hint && <span className="truncate text-xs text-muted">{item.hint}</span>}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
