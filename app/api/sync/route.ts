import { NextResponse } from 'next/server'
import { getDataVersion } from '@/lib/queries'

/**
 * Impronta dei dati condivisi per `SharedDataRefresh`: poche righe invece
 * dell'intera pagina. Protetto dalla sessione come ogni rotta privata (il
 * `proxy.ts` rimanda alla vetrina chi non è autenticato, e le query passano
 * dalla RLS). `version: null` significa "non so": il client ricarica.
 */
export async function GET() {
  const version = await getDataVersion().catch(() => null)
  return NextResponse.json({ version }, { headers: { 'Cache-Control': 'no-store' } })
}
