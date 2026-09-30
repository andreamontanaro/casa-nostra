import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { bottleNotches, parityMessage, shiftDay } = await loadTs('../lib/chores/bottle.ts')

const ANDREA = 'a'
const FEDE = 'f'

/** Una riga di v_chore_balance per il test: di default giorno feriale, oggi vuoto. */
function row(userId, fields = {}) {
  const worksFromHome = userId === FEDE
  const todayBonus = fields.todayBonus ?? (worksFromHome ? 1 : 0)
  return {
    userId,
    displayName: userId === FEDE ? 'Fede' : 'Andrea',
    worksFromHome,
    todayCount: 0,
    todayBonus,
    todayCapacity: 5 + todayBonus,
    netToday: 0,
    netBeforeToday: 0,
    netPosition: 0,
    tasksToParity: 0,
    ...fields,
  }
}

test('la prima faccenda di chi lavora da casa va nella tacca bonus, in basso', () => {
  const notches = bottleNotches([{ id: '1', name: 'Lavo i piatti' }, { id: '2', name: 'Cucino' }], 6, 1)
  assert.equal(notches.length, 6)
  assert.deepEqual(notches[0], { bonus: true, entry: { id: '1', name: 'Lavo i piatti' }, hint: null })
  assert.deepEqual(notches[1], { bonus: false, entry: { id: '2', name: 'Cucino' }, hint: null })
  assert.equal(notches.slice(2).every((n) => !n.bonus && n.entry === null), true)
})

test('nel weekend la bottiglia non ha tacca bonus', () => {
  const notches = bottleNotches([{ id: '1', name: 'Bucato' }], 5, 0)
  assert.equal(notches.length, 5)
  assert.equal(notches.some((n) => n.bonus), false)
})

test('nessuno indietro: siete pari', () => {
  const message = parityMessage([row(ANDREA), row(FEDE)], ANDREA)
  assert.equal(message.kind, 'pari')
  assert.equal(message.title, 'Siete pari')
})

test('chi è indietro legge "Ti manca", l’altro legge il nome', () => {
  const balances = [
    row(ANDREA, { todayCount: 1, netToday: -1, netPosition: -1, tasksToParity: 1 }),
    row(FEDE, { todayCount: 3, netToday: 1, netPosition: 1 }),
  ]
  assert.equal(parityMessage(balances, ANDREA).title, 'Ti manca 1 faccenda per la parità')
  assert.equal(parityMessage(balances, FEDE).title, 'Ad Andrea manca 1 faccenda per la parità')
})

test('Andrea 3, Fede 0: a Fede servono 4 faccende, la prima riempie il bonus', () => {
  const balances = [
    row(ANDREA, { todayCount: 3, netToday: 3, netPosition: 3 }),
    row(FEDE, { netToday: -3, netPosition: -3, tasksToParity: 4 }),
  ]
  const message = parityMessage(balances, FEDE)
  assert.equal(message.title, 'Ti mancano 4 faccende per la parità')
  assert.ok(message.details.includes('La prima di oggi riempie la tua tacca bonus e non conta.'))
  assert.equal(parityMessage(balances, ANDREA).title, 'A Fede mancano 4 faccende per la parità')
})

test('l’arretrato dei giorni scorsi si dice a parte', () => {
  const balances = [
    row(ANDREA, { todayCount: 0, netToday: -1, netBeforeToday: -2, netPosition: -3, tasksToParity: 3 }),
    row(FEDE, { todayCount: 2, netToday: 1, netBeforeToday: 2, netPosition: 3 }),
  ]
  assert.ok(parityMessage(balances, ANDREA).details.includes('Di cui 2 dai giorni scorsi.'))
})

test('se oggi non c’è abbastanza posto lo dice, senza chiedere l’impossibile', () => {
  const balances = [
    row(ANDREA, { todayCount: 4, netBeforeToday: -6, netToday: -1, netPosition: -7, tasksToParity: 7 }),
    row(FEDE, { netPosition: 7 }),
  ]
  const { details } = parityMessage(balances, ANDREA)
  assert.ok(details.includes("Oggi c'è posto per un’altra sola: il resto si recupera nei prossimi giorni."))
})

test('shiftDay attraversa mesi e cambi d’ora', () => {
  assert.equal(shiftDay('2026-10-01', -1), '2026-09-30')
  assert.equal(shiftDay('2026-10-25', 1), '2026-10-26')
  assert.equal(shiftDay('2026-09-30', -7), '2026-09-23')
})

const { CHORE_PRESET_GROUPS, searchChoreNames, normalize } = await loadTs('../lib/chores/presets.ts')

test('gli ambiti del codice sono quelli ammessi dal vincolo su chore_presets', async () => {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile(new URL('../docs/migrations/2026-09-30_faccende_azioni.sql', import.meta.url), 'utf8')
  const allowed = [...sql.match(/group_id IN \(([^)]*)\)/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(allowed, CHORE_PRESET_GROUPS.map((g) => g.id))
})

test('la ricerca ignora accenti, maiuscole e ordine delle parole', () => {
  const names = ['Lavo i piatti', 'Decalcifico la macchina del caffè', 'Passo l’aspirapolvere']
  assert.deepEqual(searchChoreNames('PIATTI', names), ['Lavo i piatti'])
  assert.deepEqual(searchChoreNames('caffe macchina', names), ['Decalcifico la macchina del caffè'])
  assert.deepEqual(searchChoreNames('aspirapolvere', names), ['Passo l’aspirapolvere'])
  assert.deepEqual(searchChoreNames('   ', names), [])
})

test('la ricerca tiene l’ordine ricevuto e toglie i doppioni', () => {
  const results = searchChoreNames('bagno', ['lavo il bagno', 'Lavo il bagno', 'Pulisco il bagno di sotto'])
  assert.deepEqual(results, ['lavo il bagno', 'Pulisco il bagno di sotto'])
  assert.equal(normalize('  Più ’ Già '), 'piu   gia')
})

const { recentChoreNames } = await loadTs('../lib/chores/presets.ts')

test('i recenti vanno dal più recente, senza doppioni di maiuscole', () => {
  const entries = [
    { name: 'Cucino', created_at: '2026-09-30T08:00:00Z' },
    { name: 'lavo i piatti', created_at: '2026-09-29T20:00:00Z' },
    { name: 'Lavo i piatti', created_at: '2026-09-30T21:00:00Z' },
  ]
  assert.deepEqual(recentChoreNames(entries, []), ['Lavo i piatti', 'Cucino'])
})

test('un nome tolto dai recenti torna solo se viene rifatto dopo', () => {
  const entries = [
    { name: 'Cucino', created_at: '2026-09-30T08:00:00Z' },
    { name: 'Stiro', created_at: '2026-09-29T10:00:00Z' },
  ]
  const dismissals = [
    { name_key: 'cucino', dismissed_at: '2026-09-30T09:00:00Z' },
    { name_key: 'stiro', dismissed_at: '2026-09-28T09:00:00Z' },
  ]
  // Cucino tolto dopo l'ultimo uso: fuori. Stiro rifatto dopo essere stato tolto: dentro.
  assert.deepEqual(recentChoreNames(entries, dismissals), ['Stiro'])
})

const { overflowHints } = await loadTs('../lib/chores/bottle.ts')

test('i suggerimenti stanno nelle tacche vuote sopra le faccende', () => {
  const notches = bottleNotches([{ id: '1', name: 'Spolvero' }], 5, 0, [{ id: 'h1', name: 'Stendo i panni' }, { id: 'h2', name: 'Stiro' }])
  assert.equal(notches[0].entry?.name, 'Spolvero')
  assert.equal(notches[0].hint, null)
  assert.equal(notches[1].hint?.name, 'Stendo i panni')
  assert.equal(notches[2].hint?.name, 'Stiro')
  assert.equal(notches[3].hint, null)
})

test('segnando un’altra faccenda il suggerimento sale di una tacca', () => {
  const hints = [{ id: 'h1', name: 'Stendo i panni' }]
  const before = bottleNotches([], 5, 0, hints)
  const after = bottleNotches([{ id: '1', name: 'Cucino' }], 5, 0, hints)
  assert.equal(before[0].hint?.name, 'Stendo i panni')
  assert.equal(after[0].entry?.name, 'Cucino')
  assert.equal(after[1].hint?.name, 'Stendo i panni')
})

test('i suggerimenti che non ci stanno più restano fuori dalla bottiglia', () => {
  const hints = [{ id: 'h1', name: 'Stendo' }, { id: 'h2', name: 'Stiro' }]
  const entries = [1, 2, 3, 4].map((i) => ({ id: String(i), name: 'x' }))
  assert.equal(bottleNotches(entries, 5, 0, hints)[4].hint?.name, 'Stendo')
  assert.deepEqual(overflowHints(4, 5, hints), [{ id: 'h2', name: 'Stiro' }])
  assert.deepEqual(overflowHints(2, 5, hints), [])
})
