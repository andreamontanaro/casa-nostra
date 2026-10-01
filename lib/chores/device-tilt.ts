/**
 * L'inclinazione del telefono per il liquido delle bottiglie, condivisa: un
 * solo ascoltatore dei sensori per tutte le bottiglie della pagina, attivo
 * finché almeno una lo guarda (`watchTilt`).
 *
 * Il liquido sente la gravità meno l'accelerazione del telefono — è un
 * accelerometro — quindi la fonte migliore è `accelerationIncludingGravity`
 * di `devicemotion`: con lo stesso numero si inclina quando si gira il
 * telefono e sciaborda quando lo si scuote. Il verso di quel vettore però non
 * è lo stesso ovunque (Safari su iOS l'ha storicamente opposto alla
 * specifica), quindi lo si confronta con la gravità ricavata da
 * `deviceorientation`, che invece è coerente, e si decide il segno dopo
 * qualche campione. Finché non si sa, o se il telefono non ha
 * l'accelerometro, basta l'orientamento.
 *
 * Su iOS i sensori vanno chiesti con un tocco (`requestTiltPermission`): lo
 * stato `ask` dice a `TiltPrompt` di mostrare il bottone.
 */

/** off: niente sensori (o non ancora); live: arrivano; ask: serve il permesso; denied: rifiutato. */
export type TiltStatus = 'off' | 'live' | 'ask' | 'denied'

export interface TiltReading {
  /** Inclinazione della gravità nello schermo, in radianti: positiva verso destra. */
  tilt: number
  /** Somma degli scossoni da quando si ascolta, in g: ogni bottiglia guarda la differenza. */
  jolt: number
}

const G = 9.80665
const DEG = Math.PI / 180
const STORAGE_KEY = 'chore-tilt'
/** Campioni per decidere il verso di `accelerationIncludingGravity`. */
const CALIBRATION_SAMPLES = 8
/** Senza orientamento si smette di aspettarlo e si segue la specifica. */
const CALIBRATION_GIVE_UP = 40
/** Sotto questa variazione (in g) è rumore, non uno scossone. */
const JOLT_NOISE = 0.05
/** Variazione minima dell'inclinazione per svegliare le bottiglie ferme. */
const WAKE_TILT = 0.004

const reading: TiltReading = { tilt: 0, jolt: 0 }
let status: TiltStatus = 'off'
const wakers = new Set<() => void>()
const statusListeners = new Set<() => void>()

let orientationGravity: [number, number, number] | null = null
let motionSign = 0
let calibration = 0
let calibrationSamples = 0
let motionSamples = 0
let lastGravity: [number, number, number] | null = null
let announcedTilt = 0
let askTimer: ReturnType<typeof setTimeout> | undefined

export function readTilt(): TiltReading {
  return reading
}

export function getTiltStatus(): TiltStatus {
  return status
}

export function subscribeTiltStatus(listener: () => void): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

/**
 * Ascolta i sensori finché la funzione restituita non viene chiamata.
 * `wake` arriva quando l'inclinazione cambia abbastanza da muovere il liquido.
 */
export function watchTilt(wake: () => void): () => void {
  wakers.add(wake)
  if (wakers.size === 1) start()
  return () => {
    wakers.delete(wake)
    if (wakers.size === 0) stop()
  }
}

/** Chiede i sensori (iOS): va chiamata dentro il gestore di un tocco. */
export async function requestTiltPermission(): Promise<boolean> {
  const requests = [
    typeof DeviceMotionEvent === 'undefined' ? null : permissionApi(DeviceMotionEvent),
    typeof DeviceOrientationEvent === 'undefined' ? null : permissionApi(DeviceOrientationEvent),
  ]
    .filter((request) => request !== null)
    .map((request) => request())
  try {
    const results = await Promise.all(requests)
    const granted = results.every((result) => result === 'granted')
    remember(granted ? null : 'denied')
    setStatus(granted ? 'off' : 'denied')
    return granted
  } catch {
    // Chiamata fuori da un tocco: non è un rifiuto, si può riprovare.
    return false
  }
}

function permissionApi(api: unknown): (() => Promise<string>) | null {
  const request = (api as { requestPermission?: () => Promise<string> } | undefined)?.requestPermission
  return typeof request === 'function' ? () => request.call(api) : null
}

function needsPermission(): boolean {
  return typeof DeviceMotionEvent !== 'undefined' && permissionApi(DeviceMotionEvent) !== null
}

function start() {
  if (typeof window === 'undefined') return
  window.addEventListener('deviceorientation', onOrientation)
  window.addEventListener('devicemotion', onMotion)
  // Su iOS, se il permesso c'è già i dati arrivano subito; se non arrivano, si chiede.
  // Solo sui dispositivi a tocco: Safari su Mac ha la stessa API ma nessun sensore.
  if (needsPermission() && window.matchMedia('(pointer: coarse)').matches) {
    if (recalled() === 'denied') setStatus('denied')
    else askTimer = setTimeout(() => status === 'off' && setStatus('ask'), 800)
  }
}

function stop() {
  window.removeEventListener('deviceorientation', onOrientation)
  window.removeEventListener('devicemotion', onMotion)
  clearTimeout(askTimer)
  orientationGravity = null
  lastGravity = null
  motionSamples = 0
  reading.tilt = 0
  announcedTilt = 0
  if (status !== 'denied') setStatus('off')
}

function onOrientation(event: DeviceOrientationEvent) {
  if (event.beta === null || event.gamma === null) return
  const beta = event.beta * DEG
  const gamma = event.gamma * DEG
  // La gravità nel riferimento del telefono (x a destra, y verso l'alto, z fuori
  // dallo schermo), dalla rotazione Z-X'-Y'' della specifica.
  orientationGravity = [
    Math.sin(gamma) * Math.cos(beta),
    -Math.sin(beta),
    -Math.cos(gamma) * Math.cos(beta),
  ]
  if (motionSign === 0) update(orientationGravity)
}

function onMotion(event: DeviceMotionEvent) {
  const a = event.accelerationIncludingGravity
  if (!a || a.x === null || a.y === null || a.z === null) return
  const raw: [number, number, number] = [a.x / G, a.y / G, a.z / G]

  if (motionSign === 0) {
    motionSamples++
    const size = Math.hypot(...raw)
    // Da fermo (circa 1 g) la specifica dà l'opposto della gravità.
    if (orientationGravity && size > 0.7 && size < 1.3) {
      calibration += raw[0] * orientationGravity[0] + raw[1] * orientationGravity[1] + raw[2] * orientationGravity[2]
      calibrationSamples++
    }
    if (calibrationSamples >= CALIBRATION_SAMPLES) motionSign = calibration < 0 ? 1 : -1
    else if (motionSamples >= CALIBRATION_GIVE_UP && !orientationGravity) motionSign = 1
    else return
  }
  update([-motionSign * raw[0], -motionSign * raw[1], -motionSign * raw[2]])
}

/** Dalla gravità sentita dal telefono (in g) all'inclinazione nello schermo. */
function update(gravity: [number, number, number]) {
  if (status !== 'live') setStatus('live')

  // Schermo: y verso il basso, ruotato come l'interfaccia.
  const turn = screenAngle() * DEG
  const x = gravity[0]
  const y = -gravity[1]
  const sx = x * Math.cos(turn) - y * Math.sin(turn)
  const sy = x * Math.sin(turn) + y * Math.cos(turn)

  // Telefono appoggiato in piano: la gravità esce dallo schermo e il liquido resta dritto.
  const inPlane = Math.hypot(sx, sy)
  const tilt = Math.atan2(sx, sy) * smoothstep(0.12, 0.4, inPlane)
  reading.tilt += (tilt - reading.tilt) * 0.5

  let woke = false
  if (lastGravity) {
    const change = Math.hypot(gravity[0] - lastGravity[0], gravity[1] - lastGravity[1], gravity[2] - lastGravity[2])
    if (change > JOLT_NOISE) {
      reading.jolt += Math.min(change - JOLT_NOISE, 0.5)
      woke = true
    }
  }
  lastGravity = gravity

  if (woke || Math.abs(reading.tilt - announcedTilt) > WAKE_TILT) {
    announcedTilt = reading.tilt
    for (const wake of wakers) wake()
  }
}

function screenAngle(): number {
  if (typeof screen !== 'undefined' && screen.orientation) return screen.orientation.angle
  return (window as { orientation?: number }).orientation ?? 0
}

function setStatus(next: TiltStatus) {
  if (next === status) return
  status = next
  if (next === 'live') clearTimeout(askTimer)
  for (const listener of statusListeners) listener()
}

function recalled(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function remember(value: 'denied' | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

function smoothstep(from: number, to: number, value: number): number {
  const t = Math.min(Math.max((value - from) / (to - from), 0), 1)
  return t * t * (3 - 2 * t)
}
