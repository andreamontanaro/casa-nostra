'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/fmt'
import {
  createSubscription,
  deleteSubscription,
  setNotifyHour,
  setSubscriptionActive,
  updateSubscription,
  type SubscriptionFieldErrors,
  type SubscriptionInput,
} from '@/lib/subscriptions/service'

// Niente notifiche Telegram qui: avvisano solo il promemoria e l'addebito,
// che manda il cron. Creare o correggere un abbonamento non muove soldi.

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
