/**
 * Client delle chiamate interne di MyFastweb Power Control. Fastweb non ha
 * API pubbliche: si rifanno i passi della dashboard, come il browser.
 *
 * 1. GET della pagina di login → form `formLogin` con il suo `securityToken`.
 * 2. POST `login/ajax/` con i campi del form più username e password → JSON
 *    `{ errorCode, needRecaptcha, mt, … }`. Con `needRecaptcha` ci si ferma:
 *    il captcha non si aggira mai.
 * 3. GET della pagina Power Control (~4 s) → un form per ogni dato, ognuno con
 *    il suo token. Senza sessione Fastweb rimanda a `contenuti-riservati/`.
 * 4. POST `consumi-power-control/ajax/` (multipart) con i campi di un form →
 *    `{ errorCode, data }`.
 *
 * Collaudato il 15/10/2026 da un'anteprima Vercel (iad1): nessun captcha né
 * secondo fattore. Qui non si scrive mai nei log il corpo di una risposta:
 * contiene i dati dell'intestatario.
 */

const BASE = 'https://fastweb.it'
const LOGIN_URL = `${BASE}/myfastweb/accesso/login/`
export const POWER_URL = `${BASE}/myfastweb/abbonamento/consumi-power-control/`
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const TIMEOUT_MS = 10000

/** I form della pagina Power Control, per nome nostro. */
export const POWER_FORMS = {
  realtime: 'consumptionRealtime_form',
  plugStatus: 'plugStatus_form',
  daily: 'consumptionMedium_form',
  appliances: 'consumptionAppliances_form',
  loadNotify: 'loadNotify_form',
} as const

export type PowerFormKey = keyof typeof POWER_FORMS
export type FormFields = Record<string, string>
export type PowerForms = Partial<Record<PowerFormKey, FormFields>>

/** I dati che si chiedono ad `ajax/`: i form della pagina, più la serie delle ultime 6 ore. */
export type PowerDataKey = PowerFormKey | 'latest'

/**
 * I campi da mandare per un dato. Il grafico delle ultime 6 ore sta in
 * un'altra pagina («Consumo in tempo reale», `cruscotto/consumo-per-ore/`),
 * con un form suo (`action=consumptionLatest`) che chiama lo stesso `ajax/`.
 * Il token però è uno per sessione, uguale in tutti i form (verificato il
 * 19/10/2026): i campi si ricavano da quello della potenza, senza caricare
 * una pagina in più.
 */
export function fieldsFor(forms: PowerForms | null, key: PowerDataKey): FormFields | null {
  if (key !== 'latest') return forms?.[key] ?? null
  const token = forms?.realtime?.securityToken
  return token ? { securityToken: token, action: 'consumptionLatest' } : null
}

/** I cookie di fastweb.it tra una richiesta e l'altra: fetch non li tiene da solo. */
export class CookieJar {
  private cookies: Map<string, string>
  /** Diventa true quando una risposta aggiunge, cambia o toglie un cookie. */
  changed = false

  constructor(initial: Record<string, string> = {}) {
    this.cookies = new Map(Object.entries(initial))
  }

  store(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(';')
      const eq = pair.indexOf('=')
      if (eq <= 0) continue
      const name = pair.slice(0, eq).trim()
      const value = pair.slice(eq + 1).trim()
      const expired = attributes.some((attr) => {
        const [key, val = ''] = attr.split('=').map((s) => s.trim().toLowerCase())
        if (key === 'max-age') return Number(val) <= 0
        if (key === 'expires') return Date.parse(val) < Date.now()
        return false
      })
      if (expired || value === '' || value === 'deleted') {
        this.changed = this.cookies.delete(name) || this.changed
      } else if (this.cookies.get(name) !== value) {
        this.cookies.set(name, value)
        this.changed = true
      }
    }
  }

  header() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ')
  }

  toJSON(): Record<string, string> {
    return Object.fromEntries(this.cookies)
  }
}

/** Come il browser: manda i cookie, raccoglie quelli nuovi e segue i redirect a mano. */
async function send(jar: CookieJar, url: string, init: RequestInit = {}, hops = 0): Promise<{ res: Response; url: string }> {
  const headers = new Headers(init.headers)
  headers.set('User-Agent', UA)
  const cookie = jar.header()
  if (cookie) headers.set('Cookie', cookie)
  const res = await fetch(url, { ...init, headers, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
  jar.store(res)
  const location = res.headers.get('location')
  if (res.status >= 300 && res.status < 400 && location && hops < 5) {
    await res.body?.cancel()
    return send(jar, new URL(location, url).toString(), {}, hops + 1)
  }
  return { res, url }
}

const ajaxHeaders = (referer: string) => ({ 'X-Requested-With': 'XMLHttpRequest', Origin: BASE, Referer: referer })

function decodeEntities(value: string) {
  return value
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

/** I campi di un form della pagina, come li invierebbe il browser. */
export function formFields(html: string, formId: string): FormFields | null {
  const form = html.match(new RegExp(`<form[^>]*id="${formId}"[^>]*>([\\s\\S]*?)</form>`, 'i'))
  if (!form) return null
  const fields: FormFields = {}
  for (const [tag] of form[1].matchAll(/<input[^>]*>/gi)) {
    const name = tag.match(/name="([^"]*)"/)?.[1]
    if (name) fields[name] = decodeEntities(tag.match(/value="([^"]*)"/)?.[1] ?? '')
  }
  return fields
}

// Senza import: i test (`tests/energy.test.mjs`) caricano questo file da solo.
function parseJson(text: string): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(text)
    return typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * - `ok`: sessione aperta, cookie nel jar;
 * - `captcha`: Fastweb chiede il reCAPTCHA (non si aggira);
 * - `rifiutato`: credenziali sbagliate o account bloccato;
 * - `errore`: pagina o risposta inattesa (cambiata, in manutenzione, bloccata).
 */
export type LoginOutcome = 'ok' | 'captcha' | 'rifiutato' | 'errore'

export async function login(jar: CookieJar, username: string, password: string): Promise<LoginOutcome> {
  const page = await send(jar, LOGIN_URL)
  const fields = formFields(await page.res.text(), 'formLogin')
  if (!page.res.ok || !fields?.securityToken) return 'errore'

  const res = await send(jar, `${LOGIN_URL}ajax/`, {
    method: 'POST',
    body: new URLSearchParams({ ...fields, username, password }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', ...ajaxHeaders(LOGIN_URL) },
  })
  const data = parseJson(await res.res.text())
  if (!data) return 'errore'
  if (Number(data.errorCode) !== 0) return data.needRecaptcha === true ? 'captcha' : 'rifiutato'

  // Passaggio che la pagina di login fa quando la risposta ha `mt`.
  if (data.mt) {
    const mt = await send(jar, `${BASE}/myfastweb/redirect/set-mt/`)
    await mt.res.body?.cancel()
  }
  return 'ok'
}

/**
 * I form della pagina Power Control con i loro token. null se Fastweb manda
 * altrove (sessione scaduta) o se manca il form della potenza.
 */
export async function loadPowerForms(jar: CookieJar): Promise<PowerForms | null> {
  const page = await send(jar, POWER_URL)
  const html = await page.res.text()
  if (!page.res.ok || new URL(page.url).pathname !== new URL(POWER_URL).pathname) return null
  const forms: PowerForms = {}
  for (const [key, id] of Object.entries(POWER_FORMS) as [PowerFormKey, string][]) {
    const fields = formFields(html, id)
    if (fields?.securityToken) forms[key] = fields
  }
  return forms.realtime ? forms : null
}

/**
 * - `ok`: risposta con `errorCode` 0, `data` così com'è (da ripulire!);
 * - `scaduta`: Fastweb ha risposto con una pagina invece che con JSON
 *   (redirect al login o a `contenuti-riservati/`), o con un errore: si
 *   ricaricano i token e, se serve, si rifà il login.
 */
export type PostResult = { kind: 'ok'; data: unknown } | { kind: 'scaduta' }

export async function postPowerForm(jar: CookieJar, fields: FormFields): Promise<PostResult> {
  // FormData come la dashboard; il Content-Type con il boundary lo mette fetch.
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.append(name, value)
  const res = await send(jar, `${POWER_URL}ajax/`, { method: 'POST', body: form, headers: ajaxHeaders(POWER_URL) })
  const json = parseJson(await res.res.text())
  if (!json || Number(json.errorCode) !== 0) return { kind: 'scaduta' }
  return { kind: 'ok', data: json.data }
}
