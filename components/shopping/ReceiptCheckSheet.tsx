'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Camera, Check, FileUp, ShoppingBasket } from 'lucide-react'
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
  /**
   * Scontrino arrivato da una condivisione (un'altra app → l'app installata):
   * si controlla appena la sheet è aperta, senza passare dai pulsanti.
   */
  sharedFile?: File | null
}

/**
 * Controllo scontrino dall'app. La foto viene caricata dal browser
 * direttamente su Storage e poi la Server Action la rilegge da lì: il corpo
 * di una Server Action è limitato a 1 MB, che una foto di scontrino supera
 * quasi sempre (stesso motivo per cui gli allegati delle spese si caricano
 * lato client).
 */
export function ReceiptCheckSheet({ open, onOpenChange, sharedFile }: ReceiptCheckSheetProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const cameraRef = useRef<HTMLInputElement | null>(null)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'reading'>('idle')
  const working = phase !== 'idle'
  const [result, setResult] = useState<CheckResult | null>(null)

  function close(next: boolean) {
    if (working) return
    if (!next) {
      setResult(null)
      router.refresh()
    }
    onOpenChange(next)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permette di riprovare con lo stesso file
    if (file) void checkFile(file)
  }

  async function checkFile(file: File) {
    const invalid = validateReceiptFile(file)
    if (invalid) {
      toast.error(invalid)
      return
    }

    if (working) return
    setPhase('uploading')
    setResult(null)

    try {
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

    setPhase('reading')
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
    } catch { toast.error('Il controllo non è stato completato. Verifica la connessione e riprova.') }
    finally { setPhase('idle') }
  }

  // Ogni file condiviso si controlla una volta sola, anche se la sheet si
  // riapre o l'effetto riparte.
  const checkedShare = useRef<File | null>(null)
  const checkShared = useEffectEvent((file: File) => {
    if (checkedShare.current === file) return
    checkedShare.current = file
    void checkFile(file)
  })
  useEffect(() => {
    if (open && sharedFile) checkShared(sharedFile)
  }, [open, sharedFile])

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title="Controllo scontrino"
      description="Confronta lo scontrino con la lista e spunta i prodotti comprati."
      size="auto"
      footer={
        result?.ok ? (
          <div className="space-y-2">
            <Link href={`/spese/nuova?scontrino=${result.checkId}`} onClick={() => close(false)} className="flex min-h-13 items-center justify-center rounded-2xl bg-accent px-4 py-3 font-semibold text-accent-foreground">Crea spesa da questo scontrino</Link>
            <p className="text-center text-xs text-muted">Potrai controllare i dati prima di salvare.</p>
            <Button className="w-full" variant="ghost" onClick={() => close(false)}>Torna alla lista</Button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button size="lg" onClick={() => cameraRef.current?.click()} disabled={working}><Camera className="size-5" />Scatta foto</Button>
            <Button size="lg" variant="outline" onClick={() => inputRef.current?.click()} disabled={working}><FileUp className="size-5" />Scegli file</Button>
          </div>
        )
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_RECEIPT_MIME.join(',')}
        className="hidden"
        onChange={handleFile}
      />

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <div className="flex flex-col gap-4 px-4 pb-4 pt-1">
        {working && (
          <Card role="status" className="flex items-center gap-3 px-4 py-6">
            <Spinner size="sm" />
            <span className="text-sm text-muted">
              {phase === 'uploading' ? '1 di 2 · Caricamento della foto…' : '2 di 2 · Lettura e confronto con la lista…'}
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
              {item.hint && <span className="min-w-0 break-words text-xs text-muted">{item.hint}</span>}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
