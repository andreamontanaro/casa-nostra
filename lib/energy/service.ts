import type { ServiceClient } from '@/lib/supabase/service'
import type { Database, Json } from '@/types/database'
import { getFastwebConfig, type FastwebConfig } from './config'
import { credentialsFingerprint, deriveSessionKey, openJson, sealJson } from './crypto'
import {
  CookieJar,
  POWER_FORMS,
  fieldsFor,
  loadPowerForms,
  login,
  postPowerForm,
  type PowerDataKey,
  type PowerFormKey,
  type PowerForms,
} from './fastweb'
import {
  describeError,
  emptySnapshot,
  isRecord,
  parseDetails,
  parseLatest,
  parseRealtime,
  readStoredDetails,
  readStoredHistory,
  readStoredRealtime,
  type EnergySnapshot,
  type EnergyStatus,
} from './readings'

/**
 * Logica del modulo Energia: legge Fastweb Power Control riusando la sessione
 * MyFastweb salvata, e rifà il login solo quando è scaduta.
 *
 * Riceve sempre un client esplicito, come `lib/shopping/service.ts`: qui è il
 * client service role, perché la tabella `energy_fastweb_state` non ha policy
 * RLS (contiene la sessione MyFastweb, cifrata) e nessun utente la legge.
 * L'autorizzazione la fa il chiamante: `/api/energia` sta dietro `proxy.ts` e
 * controlla la sessione di Casa Nostra prima di arrivare qui.
 *
 * Regole contro il captcha: una lettura recente si riusa (due telefoni, una
 * chiamata), al massimo un login ogni 5 minuti, e dopo un captcha o un rifiuto
 * niente login per ore, finché le credenziali non cambiano.
 */

type StateRow = Database['public']['Tables']['energy_fastweb_state']['Row']
type StateUpdate = Database['public']['Tables']['energy_fastweb_state']['Update']

const TABLE = 'energy_fastweb_state'
const ROW_ID = 1

/** Una lettura della potenza più giovane di così si riusa senza chiamare Fastweb. */
const REALTIME_FRESH_MS = 10_000
/** La serie delle ultime 6 ore ha un punto al minuto: più spesso non cambia. */
const HISTORY_FRESH_MS = 60_000
/** Consumi per giorno e per apparecchio, presa e avvisi: cambiano lentamente. */
const DETAILS_FRESH_MS = 30 * 60_000
/** Al massimo un login ogni 5 minuti, riuscito o no. */
const LOGIN_GAP_MS = 5 * 60_000
const CAPTCHA_BLOCK_MS = 6 * 60 * 60_000
const REJECTED_BLOCK_MS = 60 * 60_000

/** Fastweb non si può interrogare adesso: si mostra l'ultima lettura con questo stato. */
class FastwebUnavailable extends Error {
  constructor(readonly status: Exclude<EnergyStatus, 'ok' | 'spento'>, readonly retryAt: string | null) {
    super(`Fastweb non disponibile: ${status}`)
  }
}

interface StoredSession {
  cookies: Record<string, string>
  forms: PowerForms
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((v) => typeof v === 'string')
}

function readSession(value: unknown): StoredSession | null {
  if (!isRecord(value) || !isStringRecord(value.cookies) || !isRecord(value.forms)) return null
  const forms: PowerForms = {}
  for (const key of Object.keys(POWER_FORMS) as PowerFormKey[]) {
    const fields = value.forms[key]
    if (isStringRecord(fields)) forms[key] = fields
  }
  return { cookies: value.cookies, forms }
}

// La chiave costa ~50 ms (scrypt): una volta per istanza e per credenziali.
let keyCache: { secret: string; key: Buffer } | null = null
function sessionKey(config: FastwebConfig): Buffer {
  const secret = `${config.username}\u0000${config.password}`
  if (keyCache?.secret !== secret) keyCache = { secret, key: deriveSessionKey(config.username, config.password) }
  return keyCache.key
}

async function loadState(db: ServiceClient): Promise<StateRow> {
  const { data, error } = await db.from(TABLE).select('*').eq('id', ROW_ID).maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`Manca la riga di ${TABLE}: eseguire docs/migrations/2026-10-15_energia.sql.`)
  return data
}

async function saveState(db: ServiceClient, update: StateUpdate) {
  const { error } = await db.from(TABLE).update({ ...update, updated_at: new Date().toISOString() }).eq('id', ROW_ID)
  if (error) throw error
}

const ageMs = (iso: string | null) => (iso ? Date.now() - Date.parse(iso) : Infinity)

/** Il blocco dopo un captcha o un rifiuto, se vale ancora per queste credenziali. */
function activeBlock(row: StateRow, fingerprint: string) {
  if (!row.blocked_until || !row.blocked_reason || row.blocked_for !== fingerprint) return null
  if (Date.parse(row.blocked_until) <= Date.now()) return null
  return { status: row.blocked_reason === 'captcha' ? 'captcha' as const : 'rifiutato' as const, until: row.blocked_until }
}

/**
 * Una sessione MyFastweb per la durata di una richiesta. `call` rinnova token
 * e login al massimo una volta: se non basta, la richiesta finisce in errore
 * e si riprova al giro dopo.
 */
class FastwebSession {
  jar: CookieJar
  forms: PowerForms | null
  /** Token ricaricati o sessione cambiata: va risalvata. */
  dirty = false
  /** Login fatto in questa richiesta. */
  loggedIn = false
  private refreshed = false

  constructor(
    private db: ServiceClient,
    private config: FastwebConfig,
    private key: Buffer,
    private row: StateRow,
  ) {
    const stored = row.session_enc ? readSession(openJson(key, row.session_enc)) : null
    this.jar = new CookieJar(stored?.cookies)
    this.forms = stored?.forms ?? null
  }

  /**
   * Il `data` della risposta a un form, ancora da ripulire; null se Fastweb
   * non lo dà. Con `refresh: false` un errore non rinnova token e login: per
   * le chiamate che seguono quella della potenza, che ha già provato la
   * sessione, un errore vuol dire che è quel dato a non andare.
   */
  async call(key: PowerDataKey, { refresh = true }: { refresh?: boolean } = {}): Promise<unknown> {
    const fields = fieldsFor(this.forms, key)
    if (fields) {
      const first = await postPowerForm(this.jar, fields)
      if (first.kind === 'ok') return first.data
    }
    if (this.refreshed || !refresh) return null
    await this.refresh()
    const again = fieldsFor(this.forms, key)
    if (!again) return null
    const second = await postPowerForm(this.jar, again)
    return second.kind === 'ok' ? second.data : null
  }

  /** Cosa salvare della sessione alla fine della richiesta. */
  stateUpdate(): StateUpdate {
    const update: StateUpdate = {}
    if (this.loggedIn) {
      update.logged_in_at = new Date().toISOString()
      update.blocked_until = null
      update.blocked_reason = null
      update.blocked_for = null
    }
    if (this.forms && (this.dirty || this.jar.changed)) {
      const session: StoredSession = { cookies: this.jar.toJSON(), forms: this.forms }
      update.session_enc = sealJson(this.key, session)
    } else if (!this.forms && this.dirty) {
      // Senza token la sessione è morta: si toglie, e al prossimo giro si fa login.
      // (Se il login lo sta facendo un'altra richiesta `dirty` è false: non si tocca.)
      update.session_enc = null
    }
    return update
  }

  private async refresh() {
    this.refreshed = true
    this.dirty = true
    // Con dei cookie si prova prima a ricaricare i token; senza, dritti al login.
    this.forms = this.jar.header() ? await loadPowerForms(this.jar) : null
    if (this.forms) return
    if (await this.login() === 'adottata') return
    this.forms = await loadPowerForms(this.jar)
    if (!this.forms) throw new FastwebUnavailable('errore', null)
  }

  private async login(): Promise<'nuova' | 'adottata'> {
    const now = new Date()
    const cutoff = new Date(now.getTime() - LOGIN_GAP_MS).toISOString()
    // Lucchetto: l'UPDATE passa solo se nessuno ha tentato un login negli
    // ultimi minuti. Due richieste insieme → una sola fa il login.
    const { data, error } = await this.db
      .from(TABLE)
      .update({ login_attempt_at: now.toISOString() })
      .eq('id', ROW_ID)
      .or(`login_attempt_at.is.null,login_attempt_at.lt."${cutoff}"`)
      .select('id')
    if (error) throw error

    if (!data.length) {
      // Un'altra richiesta ha appena fatto login: se è andato bene si usa la sua sessione.
      const fresh = await loadState(this.db)
      const session = fresh.session_enc && fresh.logged_in_at !== this.row.logged_in_at
        ? readSession(openJson(this.key, fresh.session_enc))
        : null
      if (session && Object.keys(session.forms).length) {
        this.jar = new CookieJar(session.cookies)
        this.forms = session.forms
        this.dirty = false
        return 'adottata'
      }
      // Il login lo sta facendo (o l'ha appena sbagliato) un'altra richiesta:
      // la sessione salvata non si tocca, la scrive chi ha il lucchetto.
      this.dirty = false
      const retry = fresh.login_attempt_at ? Date.parse(fresh.login_attempt_at) + LOGIN_GAP_MS : now.getTime() + LOGIN_GAP_MS
      throw new FastwebUnavailable('errore', new Date(retry).toISOString())
    }

    this.jar = new CookieJar()
    const outcome = await login(this.jar, this.config.username, this.config.password)
    if (outcome === 'ok') {
      this.loggedIn = true
      return 'nuova'
    }
    if (outcome === 'captcha' || outcome === 'rifiutato') {
      const until = new Date(now.getTime() + (outcome === 'captcha' ? CAPTCHA_BLOCK_MS : REJECTED_BLOCK_MS)).toISOString()
      await saveState(this.db, {
        blocked_until: until,
        blocked_reason: outcome,
        blocked_for: credentialsFingerprint(this.key),
        session_enc: null,
      })
      throw new FastwebUnavailable(outcome, until)
    }
    throw new FastwebUnavailable('errore', new Date(now.getTime() + LOGIN_GAP_MS).toISOString())
  }
}

function snapshotFrom(row: StateRow, status: EnergyStatus, retryAt: string | null): EnergySnapshot {
  return {
    status,
    realtime: readStoredRealtime(row.realtime),
    realtimeAt: row.realtime_at,
    details: readStoredDetails(row.details),
    detailsAt: row.details_at,
    history: readStoredHistory(row.history),
    historyAt: row.history_at,
    retryAt,
  }
}

const OFF = emptySnapshot('spento')

/**
 * L'ultima lettura salvata, senza chiamare Fastweb: per il primo disegno
 * della schermata, che così non aspetta i secondi di un login.
 */
export async function getCachedEnergySnapshot(db: ServiceClient): Promise<EnergySnapshot> {
  const config = getFastwebConfig()
  if (!config) return OFF
  const row = await loadState(db)
  const block = activeBlock(row, credentialsFingerprint(sessionKey(config)))
  return snapshotFrom(row, block?.status ?? 'ok', block?.until ?? null)
}

/**
 * La lettura per `/api/energia`: dalla cache se è fresca, altrimenti da
 * Fastweb. La potenza si rilegge ogni 10 s al massimo, la serie delle ultime
 * 6 ore ogni minuto, il resto ogni 30 min.
 * Se Fastweb non risponde si restituisce l'ultima lettura con lo stato.
 */
export async function getEnergySnapshot(db: ServiceClient): Promise<EnergySnapshot> {
  const config = getFastwebConfig()
  if (!config) return OFF
  const row = await loadState(db)

  const needRealtime = ageMs(row.realtime_at) >= REALTIME_FRESH_MS
  const needHistory = ageMs(row.history_at) >= HISTORY_FRESH_MS
  const needDetails = ageMs(row.details_at) >= DETAILS_FRESH_MS
  if (!needRealtime && !needHistory && !needDetails) return snapshotFrom(row, 'ok', null)

  const key = sessionKey(config)
  const block = activeBlock(row, credentialsFingerprint(key))
  if (block) return snapshotFrom(row, block.status, block.until)

  const session = new FastwebSession(db, config, key, row)
  const update: StateUpdate = {}
  let failure: FastwebUnavailable | null = null

  try {
    // Sempre prima la potenza: se serve rinnova token e login, una volta
    // sola, e i dettagli dopo trovano la sessione già pronta.
    const realtime = parseRealtime(await session.call('realtime'))
    if (!realtime) throw new FastwebUnavailable('errore', null)
    update.realtime = realtime as unknown as Json
    update.realtime_at = new Date().toISOString()
    if (needHistory) {
      // Se la serie non arriva il resto vale lo stesso: resta l'ultima salvata.
      const history = parseLatest(await session.call('latest', { refresh: false }))
      if (history) {
        update.history = history as unknown as Json
        update.history_at = new Date().toISOString()
      }
    }
    if (needDetails) {
      // Una alla volta: sono quattro chiamate ogni mezz'ora, meglio gentili.
      const details = parseDetails({
        daily: await session.call('daily'),
        appliances: await session.call('appliances'),
        plugStatus: await session.call('plugStatus'),
        loadNotify: await session.call('loadNotify'),
      })
      update.details = details as unknown as Json
      update.details_at = new Date().toISOString()
    }
  } catch (error) {
    if (error instanceof FastwebUnavailable) failure = error
    else {
      console.error('[energia] lettura Fastweb fallita:', describeError(error))
      failure = new FastwebUnavailable('errore', null)
    }
  }

  Object.assign(update, session.stateUpdate())
  if (Object.keys(update).length) await saveState(db, update)

  const merged: StateRow = { ...row, ...update } as StateRow
  return failure ? snapshotFrom(merged, failure.status, failure.retryAt) : snapshotFrom(merged, 'ok', null)
}
