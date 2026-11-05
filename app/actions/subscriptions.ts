'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/fmt'
import { isTelegramConfigured } from '@/lib/telegram/config'
import { notifyTelegram, subscriptionAnticipatedMessage } from '@/lib/telegram/notify'
import {
  anticipateCharge,
  createSubscription,
  deleteSubscription,
  setNotifyHour,
  setSubscriptionActive,
  updateSubscription,
  type SubscriptionFieldErrors,
  type SubscriptionInput,
} from '@/lib/subscriptions/service'

// Creare o correggere un abbonamento non muove soldi: niente notifiche
// Telegram, avvisano il promemoria e l'addebito del cron. L'eccezione è
// l'anticipo, che crea una spesa: quello si notifica, come ogni spesa.

export type SubscriptionActionState = { ok?: boolean; error?: string; fieldErrors?: SubscriptionFieldErrors }

async function session() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function saveSubscriptionAction(
  id: string | null,
  input: SubscriptionInput,
): Promise<SubscriptionActionState> {
  const { supabase, user } = await session()
  if (!user) return { error: 'Non autenticato.' }

  const result = id
    ? await updateSubscription(supabase, id, input, todayISO())
    : await createSubscription(supabase, user.id, input, todayISO())
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors }

  revalidatePath('/abbonamenti')
  return { ok: true }
}

export async function setSubscriptionActiveAction(id: string, active: boolean): Promise<SubscriptionActionState> {
  const { supabase, user } = await session()
  if (!user) return { error: 'Non autenticato.' }

  const result = await setSubscriptionActive(supabase, id, active, todayISO())
  if (!result.ok) return { error: result.error }
  revalidatePath('/abbonamenti')
  return { ok: true }
}

export async function deleteSubscriptionAction(id: string): Promise<SubscriptionActionState> {
  const { supabase, user } = await session()
  if (!user) return { error: 'Non autenticato.' }

  const result = await deleteSubscription(supabase, id)
  if (!result.ok) return { error: result.error }
  revalidatePath('/abbonamenti')
  return { ok: true }
}

export async function setNotifyHourAction(hour: number): Promise<SubscriptionActionState> {
  const { supabase, user } = await session()
  if (!user) return { error: 'Non autenticato.' }

  const result = await setNotifyHour(supabase, hour)
  if (!result.ok) return { error: result.error }
  revalidatePath('/abbonamenti')
  return { ok: true }
}

/**
 * Anticipa il prossimo addebito: la spesa entra subito nel saldo, con la data
 * scelta (oggi o il giorno dell'addebito), e quel giorno il cron non la
 * ricrea. Notifica il gruppo Telegram come ogni spesa nuova.
 */
export async function anticipateSubscriptionAction(
  id: string,
  dueOn: string,
  expenseDate: string,
): Promise<SubscriptionActionState & { expenseId?: string }> {
  const { supabase, user } = await session()
  if (!user) return { error: 'Non autenticato.' }

  const result = await anticipateCharge(supabase, id, dueOn, expenseDate, todayISO())
  if (!result.ok) return { error: result.error }

  revalidatePath('/')
  revalidatePath('/spese')
  revalidatePath('/abbonamenti')

  if (isTelegramConfigured()) {
    try {
      const [profilesRes, balanceRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name'),
        supabase.from('v_user_open_balance').select('*'),
      ])
      const profiles = profilesRes.data ?? []
      const sub = result.subscription
      notifyTelegram(
        subscriptionAnticipatedMessage(
          profiles.find((p) => p.id === user.id)?.display_name ?? 'Qualcuno',
          {
            expenseId: result.expenseId,
            amount: Number(sub.amount),
            description: sub.description,
            category: sub.category,
            splitRule: sub.split_rule,
            payerName: profiles.find((p) => p.id === sub.paid_by)?.display_name ?? 'Qualcuno',
            chargedToName: profiles.find((p) => p.id !== sub.paid_by)?.display_name,
            dueOn,
            expenseDate,
          },
          balanceRes.data ?? [],
        ),
      )
    } catch (e) {
      console.error('[telegram] notifica anticipo non preparata:', e)
    }
  }

  return { ok: true, expenseId: result.expenseId }
}
