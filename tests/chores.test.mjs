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
  assert.deepEqual(notches[0], { bonus: true, entry: { id: '1', name: 'Lavo i piatti' } })
  assert.deepEqual(notches[1], { bonus: false, entry: { id: '2', name: 'Cucino' } })
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
