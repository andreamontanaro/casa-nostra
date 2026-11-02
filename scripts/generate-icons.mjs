// Genera le icone PNG dell'app installata e app/favicon.ico a partire da
// scripts/icon-source.webp.
//
//   node scripts/generate-icons.mjs
//
// Da rilanciare solo se cambia l'icona. Le PNG servono perché:
//  - iOS vuole un apple-touch-icon PNG pieno, senza trasparenza, e sulla
//    schermata Home arrotonda da sé gli angoli;
//  - Android vuole icone 192/512 e una "maskable" a tutta pagina, con il
//    disegno dentro la zona sicura (il cerchio centrale dell'80%), perché la
//    ritaglia nella forma del launcher;
//  - le scorciatoie (pressione lunga sull'icona) vogliono un'icona 96×96;
//  - app/favicon.ico è quello che Next serve come /favicon.ico, e che alcuni
//    browser preferiscono (segnalibri, cronologia);
//  - iOS, all'avvio dell'app installata, mostra uno schermo vuoto finché non
//    arriva la pagina, a meno di avere un'immagine di avvio per le misure
//    esatte dello schermo (public/splash/, misure in lib/splash-screens.json).
//    Ci va l'icona al centro, uguale a quella della schermata di avvio della
//    pagina (components/AppSplash.tsx, che usa public/splash-icon.webp), così
//    il passaggio dall'una all'altra non si vede.
//
// La sorgente è un'immagine raster: una piastrella verde con gli angoli
// arrotondati su uno sfondo scuro. Si ritaglia la piastrella e:
//  - per le icone normali si tolgono gli angoli (trasparenti);
//  - per quelle a tutta pagina il disegno si rimpicciolisce e lo sfondo della
//    piastrella si allunga fino ai bordi, così non resta il contorno
//    arrotondato dentro la forma che sceglie il sistema.
//
// Usa `sharp`, che arriva già con Next come dipendenza opzionale: niente
// pacchetti in più nel progetto.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const PUBLIC = new URL('../public/', import.meta.url)
const SPLASH = JSON.parse(await readFile(new URL('../lib/splash-screens.json', import.meta.url), 'utf8'))
const APP = new URL('../app/', import.meta.url)
const SOURCE = fileURLToPath(new URL('icon-source.webp', import.meta.url))

// La piastrella nella sorgente (1254×1254), misurata sui pixel: non è
// perfettamente quadrata, e si porta a N×N. Il raggio degli angoli e il bordo
// chiaro sono in pixel di N; il disegno sta oltre CONTENT dal bordo.
const TILE = { left: 134, top: 145, width: 988, height: 965 }
const N = 1024
const RADIUS = 248
const RIM = 30
const CONTENT = 95

const tile = await sharp(SOURCE)
  .extract(TILE)
  .resize(N, N, { fit: 'fill' })
  .removeAlpha()
  .raw()
  .toBuffer()

// Un rettangolo arrotondato bianco su nero, letto come maschera 0..1.
async function roundedMask(inset, rx, feather = 0) {
  const side = N - 2 * inset
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}">
  <rect width="${N}" height="${N}" fill="#000"/>
  <rect x="${inset}" y="${inset}" width="${side}" height="${side}" rx="${rx}" fill="#fff"/>
</svg>`
  let image = sharp(Buffer.from(svg)).greyscale()
  if (feather) image = image.blur(feather)
  const raw = await image.raw().toBuffer()
  return Float32Array.from(raw, (v) => v / 255)
}

// Sfondo della piastrella senza disegno, esteso a tutto il quadrato: media
// pesata (convoluzione normalizzata) della fascia tra il bordo chiaro e il
// disegno, sfocata finché copre anche gli angoli.
const inDrawing = (i) => {
  const x = i % N
  const y = Math.floor(i / N)
  return x >= CONTENT && x < N - CONTENT && y >= CONTENT && y < N - CONTENT
}
const band = (await roundedMask(RIM, RADIUS - RIM)).map((v, i) => (inDrawing(i) ? 0 : v))

function boxBlur(channel, radius) {
  const out = new Float32Array(channel.length)
  const tmp = new Float32Array(channel.length)
  const pass = (src, dst, step, stride) => {
    for (let line = 0; line < N; line++) {
      const base = line * stride
      let sum = 0
      for (let k = -radius; k <= radius; k++) sum += src[base + Math.min(N - 1, Math.max(0, k)) * step]
      for (let j = 0; j < N; j++) {
        dst[base + j * step] = sum / (2 * radius + 1)
        sum += src[base + Math.min(N - 1, j + radius + 1) * step] - src[base + Math.max(0, j - radius) * step]
      }
    }
  }
  pass(channel, tmp, 1, N)
  pass(tmp, out, N, 1)
  return out
}

// Il fondo per un'icona a tutta pagina con la piastrella ridotta a `scale`.
async function background(scale) {
  const side = Math.round(N * scale)
  const offset = Math.round((N - side) / 2)
  const place = (raw, channels) =>
    sharp(raw, { raw: { width: N, height: N, channels } })
      .resize(side, side)
      .extend({ top: offset, left: offset, bottom: N - side - offset, right: N - side - offset, background: '#000' })
      // extend con un colore torna in RGB: la maschera deve restare a un canale.
      .toColourspace(channels === 1 ? 'b-w' : 'srgb')
      .raw()
      .toBuffer()
  const weight = Float32Array.from(
    await place(Buffer.from(band.map((v) => v * 255)), 1),
    (v) => v / 255,
  )
  const colour = await place(tile, 3)
  let w = weight
  let c = [0, 1, 2].map((k) => Float32Array.from({ length: N * N }, (_, i) => (colour[i * 3 + k] / 255) * weight[i]))
  for (let i = 0; i < 3; i++) {
    w = boxBlur(w, 120)
    c = c.map((ch) => boxBlur(ch, 120))
  }
  const out = Buffer.alloc(N * N * 3)
  for (let i = 0; i < N * N; i++) for (let k = 0; k < 3; k++) out[i * 3 + k] = Math.round((c[k][i] / w[i]) * 255)
  return out
}

function rgba(rgb, mask) {
  const out = Buffer.alloc(N * N * 4)
  for (let i = 0; i < N * N; i++) {
    out.set(rgb.subarray(i * 3, i * 3 + 3), i * 4)
    out[i * 4 + 3] = Math.round(mask[i] * 255)
  }
  return sharp(out, { raw: { width: N, height: N, channels: 4 } })
}

// Icona normale: la piastrella con gli angoli trasparenti, appena dentro il
// suo bordo per non portarsi dietro l'alone scuro dello sfondo.
const rounded = await rgba(tile, await roundedMask(3, RADIUS - 3)).png().toBuffer()

// Icona a tutta pagina: il fondo esteso, e sopra la piastrella ridotta e
// sfumata prima del bordo chiaro, che altrimenti disegnerebbe un riquadro.
async function fullBleed(scale) {
  const side = Math.round(N * scale)
  const offset = Math.round((N - side) / 2)
  const fade = await roundedMask(RIM + 25, RADIUS - RIM - 25, 22)
  const front = await rgba(tile, fade).resize(side, side).png().toBuffer()
  return sharp(await background(scale), { raw: { width: N, height: N, channels: 3 } })
    .composite([{ input: front, top: offset, left: offset }])
    .png()
    .toBuffer()
}

// Scorciatoie: lo stesso fondo senza disegno, con il tratto nel verde menta
// del disegno.
async function shortcut(paths) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <g transform="translate(24 24) scale(2)" fill="none" stroke="#b0f9d0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
</svg>`
  const fondo = await sharp(await background(1), { raw: { width: N, height: N, channels: 3 } }).resize(96, 96).png().toBuffer()
  return sharp(fondo).composite([{ input: Buffer.from(svg) }]).png().toBuffer()
}

// Tracciati di lucide (ISC), le stesse icone dell'interfaccia.
const PLUS = '<path d="M5 12h14"/><path d="M12 5v14"/>'
const SHOPPING_BASKET =
  '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>'

// Il disegno arriva fino al 52% del lato dal centro (l'angolo del foglio):
// per la zona sicura della maskable (40%) basta ridurlo al 74%.
const maskable = await fullBleed(0.74)
const apple = await fullBleed(0.9)

const outputs = [
  ['icon-192.png', rounded, 192],
  ['icon-512.png', rounded, 512],
  ['icon-maskable-512.png', maskable, 512],
  // iOS arrotonda da sé e riempie di nero la trasparenza: niente angoli vuoti.
  ['apple-touch-icon.png', apple, 180],
  ['shortcut-nuova-spesa.png', await shortcut(PLUS), 96],
  ['shortcut-lista.png', await shortcut(SHOPPING_BASKET), 96],
]

function render(png, size) {
  return sharp(png).resize(size, size).png({ compressionLevel: 9 }).toBuffer()
}

for (const [name, png, size] of outputs) {
  const out = await render(png, size)
  await writeFile(new URL(name, PUBLIC), out)
  console.log(`${name} ${size}×${size} (${out.length} byte)`)
}

// Schermata di avvio. L'icona per la pagina è in WebP, alla densità più alta
// (3×): arriva insieme all'HTML e deve pesare poco.
const splashIcon = await sharp(rounded)
  .resize(SPLASH.iconSize * 3, SPLASH.iconSize * 3)
  .webp({ quality: 90, alphaQuality: 100 })
  .toBuffer()
await writeFile(new URL('splash-icon.webp', PUBLIC), splashIcon)
console.log(`splash-icon.webp (${splashIcon.length} byte)`)

await mkdir(new URL('splash/', PUBLIC), { recursive: true })
for (const { width, height, ratio } of SPLASH.screens) {
  const icon = SPLASH.iconSize * ratio
  const png = await sharp({
    create: { width: width * ratio, height: height * ratio, channels: 3, background: SPLASH.background },
  })
    .composite([{ input: await sharp(rounded).resize(icon, icon).png().toBuffer(), gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
  const name = `splash/${width}x${height}@${ratio}x.png`
  await writeFile(new URL(name, PUBLIC), png)
  console.log(`${name} (${png.length} byte)`)
}

// favicon.ico: un contenitore ICO con dentro PNG a 16, 32 e 48 px (formato
// che tutti i browser attuali leggono). Intestazione di 6 byte, una voce da
// 16 byte per immagine, poi i PNG uno dopo l'altro.
const sizes = [16, 32, 48]
const images = await Promise.all(sizes.map((size) => render(rounded, size)))
const header = Buffer.alloc(6 + 16 * images.length)
header.writeUInt16LE(0, 0) // riservato
header.writeUInt16LE(1, 2) // 1 = icona
header.writeUInt16LE(images.length, 4)
let offset = header.length
images.forEach((png, i) => {
  const entry = 6 + 16 * i
  header.writeUInt8(sizes[i], entry) // larghezza
  header.writeUInt8(sizes[i], entry + 1) // altezza
  header.writeUInt8(0, entry + 2) // colori in palette: nessuna
  header.writeUInt8(0, entry + 3) // riservato
  header.writeUInt16LE(1, entry + 4) // piani
  header.writeUInt16LE(32, entry + 6) // bit per pixel
  header.writeUInt32LE(png.length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += png.length
})
const ico = Buffer.concat([header, ...images])
await writeFile(new URL('favicon.ico', APP), ico)
console.log(`favicon.ico ${sizes.join('/')} px (${ico.length} byte)`)
