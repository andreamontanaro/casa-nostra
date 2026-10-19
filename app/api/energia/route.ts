import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/queries'
import { createServiceClient } from '@/lib/supabase/service'
import { getEnergySnapshot } from '@/lib/energy/service'
import { describeError, emptySnapshot } from '@/lib/energy/readings'

// Serve il runtime Node: fetch verso fastweb.it con cookie a mano e node:crypto.
export const runtime = 'nodejs'
// Il caso lento: sessione scaduta → login e pagina Power Control (~4 s l'una).
export const maxDuration = 30

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * Potenza istantanea e consumi di casa da Fastweb Power Control, per la
 * schermata Energia che la interroga ogni 15 s mentre è aperta. Protetta
 * dalla sessione come ogni rotta privata (`proxy.ts`); qui si ricontrolla
 * l'utente prima di usare il client service role, l'unico che legge la
 * sessione MyFastweb salvata.
 *
 * `?storia=<historyAt>`: la serie delle ultime 6 ore che il client ha già.
 * Se è ancora quella, la risposta non la rimanda (circa 15 KB ogni 15 s
 * sarebbero tanti sul telefono): `history` manca e il client tiene la sua.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato.' }, { status: 401, headers: NO_STORE })

  try {
    const snapshot = await getEnergySnapshot(createServiceClient())
    const known = new URL(request.url).searchParams.get('storia')
    if (known && snapshot.historyAt && Date.parse(known) === Date.parse(snapshot.historyAt)) delete snapshot.history
    return NextResponse.json(snapshot, { headers: NO_STORE })
  } catch (error) {
    // Configurazione o database (service key mancante, migration non eseguita):
    // il dettaglio va nei log, alla schermata basta sapere che non va.
    console.error('[energia]', describeError(error))
    return NextResponse.json(emptySnapshot('errore'), { status: 503, headers: NO_STORE })
  }
}
