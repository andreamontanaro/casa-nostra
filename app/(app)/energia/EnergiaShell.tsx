'use client'

import { useEffect, useState } from 'react'
import { CircleCheck, CloudOff, Info, ShieldAlert, Unplug } from 'lucide-react'
import { ApplianceList } from '@/components/energy/ApplianceList'
import { DailyBars } from '@/components/energy/DailyBars'
import { PowerBattery } from '@/components/energy/PowerBattery'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDateTime } from '@/lib/fmt'
import type { EnergySnapshot, EnergyStatus } from '@/lib/energy/readings'
import { cn } from '@/lib/utils'

/** Ogni quanto si chiede la potenza, a pagina aperta e visibile. */
const POLL_MS = 15_000
/** Tetto dell'attesa tra un tentativo e l'altro quando Fastweb non risponde. */
const MAX_WAIT_MS = 5 * 60_000
/** Focus e ritorno in rete non fanno partire richieste più fitte di così. */
const MIN_GAP_MS = 5_000
/** Una lettura più vecchia di così si mostra attenuata, con l'ora. */
const STALE_MS = 2 * 60_000

const TIME = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })

const STATUSES: EnergyStatus[] = ['ok', 'spento', 'captcha', 'rifiutato', 'errore']

function isSnapshot(value: unknown): value is EnergySnapshot {
  return typeof value === 'object' && value !== null && STATUSES.includes((value as EnergySnapshot).status)
}

/** «adesso», «12 s fa», «3 min fa», poi l'ora. */
function agoLabel(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (seconds < 10) return 'adesso'
  if (seconds < 60) return `${seconds} s fa`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min fa`
  return `alle ${TIME.format(new Date(iso))}`
}

/**
 * Tiene aggiornata la lettura: ogni 15 s chiede `/api/energia`, solo a pagina
 * visibile e in rete, una richiesta alla volta. Al ritorno nella pagina chiede
 * subito. Se Fastweb non risponde l'attesa raddoppia (fino a 5 minuti), e dopo
 * un captcha o un rifiuto si aspetta l'ora che dice il server.
 */
function useEnergyPolling(initial: EnergySnapshot) {
  const [snapshot, setSnapshot] = useState(initial)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initial.status === 'spento') return
    let timer: number | undefined
    let inFlight = false
    let lastStart = 0
    let failures = 0
    let stopped = false

    async function tick() {
      window.clearTimeout(timer)
      if (stopped || inFlight) return
      // A pagina nascosta o offline non si chiede niente: riparte con gli eventi sotto.
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      inFlight = true
      lastStart = Date.now()
      setLoading(true)
      let wait = POLL_MS
      try {
        const res = await fetch('/api/energia', { cache: 'no-store' })
        // Sessione di Casa Nostra scaduta: il proxy rimanda alla vetrina.
        if (res.redirected) throw new Error('sessione scaduta')
        const data: unknown = await res.json()
        if (!isSnapshot(data)) throw new Error('risposta inattesa')
        setSnapshot(data)
        if (data.status === 'spento') stopped = true
        failures = data.status === 'ok' ? 0 : failures + 1
        if (data.retryAt) wait = Math.max(wait, Date.parse(data.retryAt) - Date.now())
      } catch {
        failures += 1
      } finally {
        inFlight = false
        setLoading(false)
      }
      if (failures) wait = Math.max(wait, POLL_MS * 2 ** Math.min(failures, 5))
      if (!stopped) timer = window.setTimeout(tick, Math.min(wait, MAX_WAIT_MS))
    }

    function wake() {
      if (Date.now() - lastStart >= MIN_GAP_MS) tick()
    }

    tick()
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    window.addEventListener('online', wake)
    return () => {
      stopped = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
      window.removeEventListener('online', wake)
    }
  }, [initial.status])

  return { snapshot, loading }
}

/** L'ora del client, rinfrescata ogni 5 s; null finché la pagina non è idratata. */
function useNow() {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    const timer = window.setInterval(update, 5000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

function StatusNotice({ snapshot }: { snapshot: EnergySnapshot }) {
  const retry = snapshot.retryAt ? `alle ${TIME.format(new Date(snapshot.retryAt))}` : 'tra poco'
  const notice = {
    ok: null,
    spento: { Icon: Info, text: 'Il collegamento con Fastweb Power Control non è ancora configurato.' },
    captcha: { Icon: ShieldAlert, text: `Fastweb ha chiesto una verifica anti-robot. Per non insistere riprovo ${retry}.` },
    rifiutato: { Icon: ShieldAlert, text: `Fastweb non ha accettato le credenziali MyFastweb. Riprovo ${retry}; se la password è cambiata va aggiornata anche qui.` },
    errore: { Icon: CloudOff, text: `Fastweb non risponde in questo momento. Riprovo ${retry}${snapshot.realtime ? ' e intanto mostro l’ultima lettura' : ''}.` },
  }[snapshot.status]
  if (!notice) return null
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-sm">
      <notice.Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
      <p>{notice.text}</p>
    </div>
  )
}

export function EnergiaShell({ initial }: { initial: EnergySnapshot }) {
  const { snapshot, loading } = useEnergyPolling(initial)
  const now = useNow()
  const { realtime, realtimeAt, details } = snapshot
  const stale = now !== null && realtimeAt !== null && now - Date.parse(realtimeAt) > STALE_MS
  const live = snapshot.status === 'ok' && !stale && realtime !== null

  return (
    <div className="space-y-5 px-4 pt-6 pb-24 lg:pb-8">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h1 className="font-display text-3xl font-semibold">Energia</h1>
          <p className="text-sm text-muted">Fastweb Power Control</p>
        </div>
        {realtimeAt && now !== null && (
          <p className="flex min-h-6 items-center gap-2 text-xs text-muted" aria-live="off">
            <span
              aria-hidden
              className={cn('size-2 rounded-full', live ? 'bg-accent motion-safe:animate-pulse' : 'bg-border-strong')}
            />
            {live ? 'In diretta' : 'Ultima lettura'} · {agoLabel(realtimeAt, now)}
            {loading && <span className="sr-only">, aggiornamento in corso</span>}
          </p>
        )}
      </header>

      <StatusNotice snapshot={snapshot} />

      {details?.plugOnline === false && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning-muted p-4 text-sm">
          <Unplug className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>La presa Power Control non risponde: controlla che sia collegata e accesa. Finché non torna, le letture si fermano.</p>
        </div>
      )}

      {snapshot.status !== 'spento' && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Card className="p-5 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">Consumo in tempo reale</h2>
            {realtime ? (
              <PowerBattery reading={realtime} stale={stale || snapshot.status !== 'ok'} />
            ) : (
              <div aria-hidden>
                <Skeleton className="h-9 w-32 rounded-lg" />
                <Skeleton className="mt-2 h-4 w-44" />
                <Skeleton className="mt-5 h-24 rounded-[22px]" />
              </div>
            )}
          </Card>

          <Card className="min-w-0 p-5">
            <h2 className="text-sm font-semibold">Ultimi 7 giorni</h2>
            {details?.days.length ? (
              <div className="mt-3"><DailyBars days={details.days} /></div>
            ) : (
              <EmptyDetails loaded={details !== null} text="Fastweb non ha ancora consumi giornalieri da mostrare." />
            )}
          </Card>

          <Card className="min-w-0 p-5">
            <h2 className="text-sm font-semibold">Per apparecchio</h2>
            <p className="mt-1 mb-4 text-xs text-muted">Stima di Fastweb sugli ultimi 7 giorni</p>
            {details?.appliances.length ? (
              <ApplianceList appliances={details.appliances} />
            ) : (
              <EmptyDetails loaded={details !== null} text="Fastweb non ha ancora riconosciuto gli apparecchi di casa." />
            )}
          </Card>

          <Card className="min-w-0 p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold">Avvisi di distacco</h2>
            {details?.notices.length ? (
              <ul className="mt-3 divide-y divide-border">
                {details.notices.map((notice, i) => (
                  <li key={`${notice.at}-${i}`} className="py-3 text-sm">
                    {notice.at && <p className="text-xs text-muted">{formatDateTime(notice.at)}</p>}
                    <p>{notice.text}</p>
                  </li>
                ))}
              </ul>
            ) : details ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                <CircleCheck className="size-4 shrink-0 text-accent" aria-hidden />
                Nessun avviso: il contatore non ha staccato.
              </p>
            ) : (
              <EmptyDetails loaded={false} text="" />
            )}
          </Card>
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted">
        La potenza si aggiorna ogni 15 secondi mentre questa pagina è aperta, i consumi ogni mezz’ora.
        {details?.plugOnline === true && ' La presa Power Control è collegata.'}
      </p>
    </div>
  )
}

function EmptyDetails({ loaded, text }: { loaded: boolean; text: string }) {
  if (loaded) return <p className="mt-3 text-sm text-muted">{text}</p>
  return (
    <div aria-hidden className="mt-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}
