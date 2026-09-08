import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProfiles, getCurrentUser, getFrequentDescriptions } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import { ExpenseForm, type ExpenseDraft } from './ExpenseForm'

export default async function NuovaSpesaPage({ searchParams }: { searchParams: Promise<{ scontrino?: string }> }) {
  const [user, profiles, suggestions, params] = await Promise.all([
    getCurrentUser(), getProfiles(), getFrequentDescriptions(5), searchParams,
  ])
  if (!user) return null
  let initialDraft: Partial<ExpenseDraft> | undefined
  let sourceReceiptId: string | undefined
  let receiptError = false
  if (params.scontrino) {
    const db = await createClient()
    const validId = /^[0-9a-f-]{36}$/i.test(params.scontrino)
    const receipt = validId ? (await db.from('shopping_receipt_checks')
      .select('id, store_name, receipt_total, receipt_date').eq('id', params.scontrino).maybeSingle()).data : null
    if (receipt) {
      sourceReceiptId = receipt.id
      initialDraft = {
        amount: receipt.receipt_total?.toFixed(2).replace('.', ',') ?? '',
        description: receipt.store_name ? `Spesa da ${receipt.store_name}` : 'Spesa da scontrino',
        ...(receipt.receipt_date ? { expenseDate: receipt.receipt_date } : {}),
      }
    } else receiptError = true
  }
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <header className="flex items-center gap-3 px-4 pb-2 pt-6">
        <Link href={sourceReceiptId ? '/lista' : '/'} className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-raised" aria-label="Torna indietro"><ArrowLeft className="size-5" /></Link>
        <h1 className="font-display text-3xl font-semibold">Nuova spesa</h1>
      </header>
      {sourceReceiptId && <p className="mx-4 mt-3 rounded-2xl bg-accent-muted p-4 text-sm">Ho preparato i dati dello scontrino. Controlla importo, categoria e pagante: la spesa verrà registrata e la foto allegata quando premi “Salva spesa”.</p>}
      {receiptError ? <p role="alert" className="m-4 rounded-2xl bg-surface p-4">Non riesco a recuperare lo scontrino. <Link href="/lista" className="text-accent underline">Torna alla lista</Link> oppure <Link href="/spese/nuova" className="text-accent underline">inserisci la spesa a mano</Link>.</p> :
        <ExpenseForm key={sourceReceiptId ?? 'new'} profiles={profiles} currentUserId={user.id} suggestions={suggestions} redirectTo={sourceReceiptId ? '/spese' : '/'} initialDraft={initialDraft} sourceReceiptId={sourceReceiptId} />}
    </div>
  )
}
