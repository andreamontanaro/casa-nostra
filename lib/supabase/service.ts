import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type ServiceClient = SupabaseClient<Database>

/**
 * Client Supabase con la service role key: NON passa da RLS e non ha sessione
 * utente. Serve solo al webhook Telegram, che riceve richieste da Telegram
 * (nessun cookie di sessione) ma deve comunque leggere e scrivere i dati dei
 * due conviventi.
 *
 * Da usare esclusivamente in codice server-side: la chiave non ha prefisso
 * NEXT_PUBLIC_ e non deve mai finire nel bundle client. L'autorizzazione, qui,
 * la fa il chiamante: il webhook accetta solo update firmati con il secret e
 * solo messaggi di account Telegram collegati a un profilo.
 */
export function createServiceClient(): ServiceClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase service client non configurato: mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.',
    )
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
