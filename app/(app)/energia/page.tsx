import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/queries'
import { createServiceClient } from '@/lib/supabase/service'
import { getCachedEnergySnapshot } from '@/lib/energy/service'
import { describeError, type EnergySnapshot } from '@/lib/energy/readings'
import { EnergiaShell } from './EnergiaShell'

const UNAVAILABLE: EnergySnapshot = { status: 'errore', realtime: null, realtimeAt: null, details: null, detailsAt: null, retryAt: null }

/**
 * Il primo disegno usa l'ultima lettura salvata, senza chiamare Fastweb: la
 * pagina arriva subito anche quando servirebbe un login (secondi). Poi
 * `EnergiaShell` chiede la lettura nuova a `/api/energia`.
 */
export default async function EnergiaPage() {
  // Il proxy lo garantisce già; qui si ricontrolla prima di usare il service role.
  if (!(await getCurrentUser())) redirect('/landing')

  let initial = UNAVAILABLE
  try {
    initial = await getCachedEnergySnapshot(createServiceClient())
  } catch (error) {
    console.error('[energia]', describeError(error))
  }
  return <EnergiaShell initial={initial} />
}
