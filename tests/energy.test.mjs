import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { loadTs } from './load-ts.mjs'

const {
  batteryLevel, DEFAULT_LIMIT_KW, toNumber, parseRealtime, readStoredRealtime, readStoredDetails, describeError,
} = await loadTs('../lib/energy/readings.ts')
const { describeShape } = await loadTs('../lib/energy/shape.ts')
const { deriveSessionKey, credentialsFingerprint, sealJson, openJson } = await loadTs('../lib/energy/crypto.ts')
const { CookieJar, formFields } = await loadTs('../lib/energy/fastweb.ts')

// ─── Batteria ─────────────────────────────────────────────────

test('la batteria si riempie in proporzione al limite del contatore', () => {
  assert.deepEqual(batteryLevel(526, 3), { fill: 526 / 3000, percent: 18, band: 'tranquillo', limitKw: 3 })
  assert.equal(batteryLevel(1500, 3).fill, 0.5)
})

test('senza realtime_max il limite è 3 kW', () => {
  assert.equal(DEFAULT_LIMIT_KW, 3)
  assert.equal(batteryLevel(1500, null).limitKw, 3)
  assert.equal(batteryLevel(1500, 0).limitKw, 3)
})

test('fasce: tranquillo sotto il 70%, attenzione fino al limite, oltre sopra', () => {
  assert.equal(batteryLevel(2099, 3).band, 'tranquillo')
  assert.equal(batteryLevel(2100, 3).band, 'attenzione')
  assert.equal(batteryLevel(3000, 3).band, 'attenzione')
  assert.equal(batteryLevel(3001, 3).band, 'oltre')
})

test('oltre il limite la batteria resta piena ma la percentuale dice il vero', () => {
  const level = batteryLevel(3600, 3)
  assert.equal(level.fill, 1)
  assert.equal(level.percent, 120)
  assert.equal(batteryLevel(-5, 3).fill, 0)
})

// ─── Lettura delle risposte ───────────────────────────────────

test('toNumber legge numeri e stringhe, anche all’italiana', () => {
  assert.equal(toNumber(526), 526)
  assert.equal(toNumber('526'), 526)
  assert.equal(toNumber('3.3'), 3.3)
  assert.equal(toNumber('3,3'), 3.3)
  assert.equal(toNumber('1.234,5'), 1234.5)
  assert.equal(toNumber('1.234'), 1234)
  assert.equal(toNumber('abc'), null)
  assert.equal(toNumber(''), null)
  assert.equal(toNumber(Infinity), null)
  assert.equal(toNumber(null), null)
})

test('parseRealtime tiene solo potenza e limite, mai i dati dell’intestatario', () => {
  const data = {
    realtime: '526',
    realtime_max: 3,
    realtime_color: 'green',
    realtime_sin: { codiceFiscale: 'RSSMRA80A01H501U', email: 'a@b.it', pod: 'IT001E12345678' },
  }
  const reading = parseRealtime(data)
  assert.deepEqual(reading, { watts: 526, limitKw: 3 })
  assert.deepEqual(Object.keys(reading), ['watts', 'limitKw'])
  assert.doesNotMatch(JSON.stringify(reading), /RSSMRA|@|IT001/)
})

test('parseRealtime rifiuta letture mancanti o negative', () => {
  assert.equal(parseRealtime(null), null)
  assert.equal(parseRealtime({}), null)
  assert.equal(parseRealtime({ realtime: -1 }), null)
  assert.deepEqual(parseRealtime({ realtime: 10, realtime_max: 0 }), { watts: 10, limitKw: null })
})

test('la cache si rilegge con le stesse regole', () => {
  assert.deepEqual(readStoredRealtime({ watts: 526, limitKw: 3, extra: 'x' }), { watts: 526, limitKw: 3 })
  assert.equal(readStoredRealtime('526'), null)
  const details = readStoredDetails({
    days: [{ date: '2026-10-14', kwh: 7.4 }, { date: 'ieri', kwh: 1 }, { date: '2026-10-13', kwh: -1 }],
    appliances: [{ name: ' Frigo ', kwh: '2,5' }, { name: '', kwh: 1 }],
    plugOnline: true,
    notices: [{ at: '2026-10-14T18:00:00Z', text: 'Distacco' }, { text: '' }],
    segreto: 'no',
  })
  assert.deepEqual(details, {
    days: [{ date: '2026-10-14', kwh: 7.4 }],
    appliances: [{ name: 'Frigo', kwh: 2.5 }],
    plugOnline: true,
    notices: [{ at: '2026-10-14T18:00:00Z', text: 'Distacco' }],
  })
  assert.equal(readStoredDetails(null), null)
})

test('describeError legge anche gli errori di Supabase, che non sono Error', () => {
  assert.equal(describeError(new Error('a')), 'a')
  assert.equal(describeError({ message: 'b', code: '42P01' }), 'b')
  assert.equal(describeError('c'), 'c')
})

// ─── Modalità diagnostica ─────────────────────────────────────

test('describeShape toglie le chiavi personali e maschera i testi sospetti', () => {
  const shape = describeShape({
    errorCode: 0,
    data: {
      realtime: 526,
      realtime_sin: { cf: 'RSSMRA80A01H501U' },
      codiceCliente: 1234567,
      intestatario: 'Mario Rossi',
      apparecchi: [{ name: 'frigo', wh: 1200 }, { name: 'forno', wh: 800 }, { name: 'tv', wh: 1 }, { name: 'luci', wh: 2 }],
      giorno: '2026-10-14',
      nota: 'scrivi a mario@example.com',
      pod: 'IT001E12345678',
      codice: 'RSSMRA80A01H501U',
    },
  })
  assert.equal(shape.errorCode, 0)
  assert.equal(shape.data.realtime, 526)
  assert.equal(shape.data.realtime_sin, '‹tolto›')
  assert.equal(shape.data.codiceCliente, '‹tolto›')
  assert.equal(shape.data.intestatario, '‹tolto›')
  assert.equal(shape.data.pod, '‹tolto›')
  assert.equal(shape.data.codice, '‹tolto›')
  assert.equal(shape.data.giorno, '2026-10-14')
  assert.match(shape.data.nota, /^‹testo/)
  assert.equal(shape.data.apparecchi['‹array›'], 4)
  assert.deepEqual(shape.data.apparecchi.primi[0], { name: 'frigo', wh: 1200 })
  assert.equal(shape.data.apparecchi.primi.length, 3)
  assert.doesNotMatch(JSON.stringify(shape), /RSSMRA|mario@|IT001E|Rossi|1234567/)
})

// ─── Cifratura della sessione ─────────────────────────────────

test('la sessione cifrata si riapre solo con le stesse credenziali', () => {
  const key = deriveSessionKey('utente', 'password')
  const session = { cookies: { PHPSESSID: 'abc' }, forms: { realtime: { securityToken: 'x'.repeat(64) } } }
  const sealed = sealJson(key, session)
  assert.match(sealed, /^v1\./)
  assert.doesNotMatch(sealed, /PHPSESSID|abc/)
  assert.deepEqual(openJson(key, sealed), session)
  assert.equal(openJson(deriveSessionKey('utente', 'nuova'), sealed), null)
  assert.equal(openJson(key, 'v1.rotto'), null)
  assert.equal(openJson(key, sealed.slice(0, -4) + 'AAAA'), null)
})

test('l’impronta delle credenziali è stabile e cambia con la password', () => {
  const a = credentialsFingerprint(deriveSessionKey('utente', 'password'))
  assert.equal(a, credentialsFingerprint(deriveSessionKey('utente', 'password')))
  assert.notEqual(a, credentialsFingerprint(deriveSessionKey('utente', 'altra')))
  assert.match(a, /^[0-9a-f]{16}$/)
})

// ─── Client Fastweb ───────────────────────────────────────────

function withCookies(...lines) {
  const headers = new Headers()
  for (const line of lines) headers.append('Set-Cookie', line)
  return new Response(null, { headers })
}

test('il cookie jar aggiunge, aggiorna e toglie i cookie come il browser', () => {
  const jar = new CookieJar({ vecchio: '1' })
  assert.equal(jar.changed, false)
  jar.store(withCookies('PHPSESSID=abc; path=/; HttpOnly', 'altro=x=y; Secure'))
  assert.deepEqual(jar.toJSON(), { vecchio: '1', PHPSESSID: 'abc', altro: 'x=y' })
  assert.equal(jar.changed, true)
  assert.equal(jar.header(), 'vecchio=1; PHPSESSID=abc; altro=x=y')

  const same = new CookieJar(jar.toJSON())
  same.store(withCookies('PHPSESSID=abc; path=/'))
  assert.equal(same.changed, false)

  same.store(withCookies('vecchio=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT', 'altro=; Max-Age=0'))
  assert.deepEqual(same.toJSON(), { PHPSESSID: 'abc' })
  assert.equal(same.changed, true)
})

test('formFields legge gli input di un form, con le entità decodificate', () => {
  const html = `
    <form id="altro"><input name="x" value="no"></form>
    <form method="post" id="consumptionMedium_form" class="f">
      <input type="hidden" name="securityToken" value="${'a'.repeat(64)}">
      <input type="hidden" name="action" value="consumptionMedium" />
      <input type="hidden" name="period" value="last-seven-days">
      <input type="hidden" name="nota" value="A &amp; B &quot;C&quot;">
      <input type="submit">
    </form>`
  assert.deepEqual(formFields(html, 'consumptionMedium_form'), {
    securityToken: 'a'.repeat(64),
    action: 'consumptionMedium',
    period: 'last-seven-days',
    nota: 'A & B "C"',
  })
  assert.equal(formFields(html, 'mancante'), null)
})

// ─── Confini ──────────────────────────────────────────────────

async function sourceFiles(dir) {
  const out = []
  for (const entry of await readdir(new URL(dir, import.meta.url), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) out.push(...await sourceFiles(path))
    else if (/\.tsx?$/.test(entry.name)) out.push(path)
  }
  return out
}

test('il codice lato server dell’energia non finisce nei componenti client', async () => {
  const serverOnly = /from ['"]@\/lib\/energy\/(service|fastweb|crypto|config)['"]/
  const files = [...await sourceFiles('../app'), ...await sourceFiles('../components')]
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8')
    if (/^['"]use client['"]/m.test(source)) assert.doesNotMatch(source, serverOnly, `${file} è un componente client`)
  }
})
