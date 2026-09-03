'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isTelegramConfigured } from '@/lib/telegram/config'
import { notifyTelegram, settlementRegisteredMessage } from '@/lib/telegram/notify'

export async function registerSettlement(
  notes?: string,
  expenseIds?: string[],
) {
  const supabase = await createClient()

  const { data: settlementId, error } = await supabase.rpc('register_settlement', {
    p_notes: notes,
    p_expense_ids: expenseIds,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/')
  revalidatePath('/spese')
  revalidatePath('/conguaglio')

  await notifySettlement(supabase, settlementId)

  redirect('/?ok=settlement-registered')
}

/**
 * Avvisa il gruppo Telegram del conguaglio appena registrato. I dati vengono
 * riletti dal conguaglio creato dalla RPC (importo e direzione li decide il
 * database, non il client). Non solleva mai.
 */
async function notifySettlement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  settlementId: string | null,
) {
  if (!isTelegramConfigured() || !settlementId) return

  try {
    const { data: { user } } = await supabase.auth.getUser()

    const [settlementRes, countRes, balanceRes, profilesRes] = await Promise.all([
      supabase
        .from('settlements')
        .select(
          '*, from_user:profiles!settlements_from_user_id_fkey(display_name), to_user:profiles!settlements_to_user_id_fkey(display_name)',
        )
        .eq('id', settlementId)
        .single(),
      supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('settlement_id', settlementId),
      supabase.from('v_user_open_balance').select('*'),
      supabase.from('profiles').select('id, display_name'),
    ])

    const settlement = settlementRes.data
    if (!settlement) return

    const actorName =
      profilesRes.data?.find((p) => p.id === user?.id)?.display_name ?? 'Qualcuno'

    notifyTelegram(
      settlementRegisteredMessage({
        actorName,
        amount: settlement.amount,
        fromName: settlement.from_user?.display_name ?? '?',
        toName: settlement.to_user?.display_name ?? '?',
        expenseCount: countRes.count ?? 0,
        balance: balanceRes.data ?? [],
      }),
    )
  } catch (e) {
    console.error('[telegram] notifica conguaglio non preparata:', e)
  }
}
