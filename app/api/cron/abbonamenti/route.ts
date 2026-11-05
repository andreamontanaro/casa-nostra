import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runSubscriptionJobs } from '@/lib/subscriptions/service'

export const runtime = 'nodejs'
export const maxDuration = 30

const NO_STORE = { 'Cache-Control': 'no-store' }

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') ?? ''
  const expected = Buffer.from(`Bearer ${secret}`)
  const given = Buffer.from(header)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/**
 * La sveglia oraria degli abbonamenti: la chiama pg_cron di Supabase (con
 * pg_net) al minuto 2 di ogni ora, ma va bene anche Vercel Cron, che manda lo
 * stesso header. Prima dell'ora scelta non fa niente; da lì registra le spese
 * degli addebiti di oggi e manda i promemoria, una volta sola.
 *
 * Non ha sessione: la esclude `proxy.ts`, e l'autorizzazione è il secret
 * condiviso `CRON_SECRET` nell'header `Authorization: Bearer …`. Solo dopo
 * quel controllo si crea il client service role. Senza `CRON_SECRET` la rotta
 * è spenta e l'app funziona come prima (gli abbonamenti restano in elenco, ma
 * nessuna spesa si registra da sola).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET non configurato.' }, { status: 503, headers: NO_STORE })
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401, headers: NO_STORE })
  }

  try {
    const result = await runSubscriptionJobs(createServiceClient())
    return NextResponse.json(result, { headers: NO_STORE })
  } catch (error) {
    console.error('[abbonamenti] esecuzione fallita:', error)
    return NextResponse.json({ error: 'Esecuzione non riuscita.' }, { status: 500, headers: NO_STORE })
  }
}
