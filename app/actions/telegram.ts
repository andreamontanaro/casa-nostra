'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isTelegramConfigured } from '@/lib/telegram/config'
import { sendTelegramMessage } from '@/lib/telegram/api'
import { settlementRequestedMessage } from '@/lib/telegram/notify'

export type TelegramFormState = {
  error?: string
  fieldErrors?: Partial<Record<string, string>>
}

/**
 * Collega (o scollega, con campo vuoto) l'account Telegram al profilo di chi è
 * loggato. L'id si scopre scrivendo /id al bot; la policy RLS `profiles_update_own`
 * garantisce che ciascuno possa toccare solo la propria riga.
 */
export async function linkTelegramAccount(
  _prev: TelegramFormState,
  formData: FormData,
): Promise<TelegramFormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const raw = ((formData.get('telegram_user_id') as string) ?? '').trim()

  let telegramUserId: number | null = null
  if (raw) {
    if (!/^\d{1,15}$/.test(raw)) {
      return {
        fieldErrors: {
          telegram_user_id: 'Inserisci solo il numero dell\'id, senza @ né spazi.',
        },
      }
    }
    telegramUserId = Number(raw)
    if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
      return { fieldErrors: { telegram_user_id: 'Id Telegram non valido.' } }
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ telegram_user_id: telegramUserId })
    .eq('id', user.id)

  if (error) {
    // 23505: l'id è già collegato all'altro profilo.
    if (error.code === '23505') {
      return {
        fieldErrors: {
          telegram_user_id: 'Questo account Telegram è già collegato all\'altro profilo.',
        },
      }
    }
    return { error: 'Errore durante il salvataggio. Riprova.' }
  }

  revalidatePath('/impostazioni')
  redirect(`/impostazioni?ok=${telegramUserId ? 'telegram-linked' : 'telegram-unlinked'}`)
}

export type RequestSettlementResult = { ok: true } | { ok: false; error: string }

/**
 * Manda nel gruppo Telegram un promemoria «X ha richiesto un conguaglio».
 * Non tocca il database: il conguaglio vero si registra dall'app dopo il bonifico.
 */
export async function requestSettlementOnTelegram(): Promise<RequestSettlementResult> {
  if (!isTelegramConfigured()) {
    return { ok: false, error: 'Notifiche Telegram non configurate.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autenticato.' }

  const [profileRes, balanceRes] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).single(),
    supabase.from('v_user_open_balance').select('*'),
  ])

  const message = settlementRequestedMessage(
    profileRes.data?.display_name ?? 'Qualcuno',
    balanceRes.data ?? [],
  )

  // Qui l'esito interessa all'utente (mostra un toast), quindi si attende l'invio
  // invece di rimandarlo dopo la risposta.
  const sent = await sendTelegramMessage(message)
  return sent ? { ok: true } : { ok: false, error: 'Telegram non ha accettato il messaggio.' }
}
