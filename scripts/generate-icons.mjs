// Genera le icone PNG dell'app installata e app/favicon.ico a partire da
// public/icon.svg.
//
//   node scripts/generate-icons.mjs
//
// Da rilanciare solo se cambia l'icona. Le PNG servono perché:
//  - iOS ignora un apple-touch-icon SVG e sulla schermata Home mette uno
//    screenshot della pagina;
//  - Android vuole icone 192/512 e una "maskable" a tutta pagina, con il
//    disegno dentro la zona sicura (il cerchio centrale dell'80%), perché la
//    ritaglia nella forma del launcher;
//  - le scorciatoie (pressione lunga sull'icona) vogliono un'icona 96×96;
//  - app/favicon.ico è quello che Next serve come /favicon.ico, e che alcuni
//    browser preferiscono all'SVG (segnalibri, cronologia).
//
// Usa `sharp`, che arriva già con Next come dipendenza opzionale: niente
// pacchetti in più nel progetto.
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const PUBLIC = new URL('../public/', import.meta.url)
const APP = new URL('../app/', import.meta.url)
const source = await readFile(new URL('icon.svg', PUBLIC), 'utf8')

// L'SVG sorgente è un quadrato arrotondato (rx) con il disegno sopra. Per le
// varianti a tutta pagina si toglie l'arrotondamento e si rimpicciolisce il
// disegno attorno al centro.
const [, head, rest] = source.match(/^([\s\S]*?<rect[^>]*?\/>)([\s\S]*)<\/svg>\s*$/)
function fullBleed(scale) {
  const square = head.replace(/\s+rx="[^"]*"/, '')
  return `${square}<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${rest}</g></svg>`
}

// Tinte e sfondo dell'icona dell'app, riusati per le scorciatoie.
const background = source.match(/<defs>[\s\S]*?<\/defs>/)[0]
function shortcut(paths) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${background}
  <rect width="96" height="96" fill="url(#bg)"/>
  <g transform="translate(24 24) scale(2)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
</svg>`
}

// Tracciati di lucide (ISC), le stesse icone dell'interfaccia.
const PLUS = '<path d="M5 12h14"/><path d="M12 5v14"/>'
const SHOPPING_BASKET =
  '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>'

const outputs = [
  ['icon-192.png', source, 192],
  ['icon-512.png', source, 512],
  // Zona sicura: il disegno deve stare nel cerchio di raggio 40%.
  ['icon-maskable-512.png', fullBleed(0.78), 512],
  // iOS arrotonda da sé e riempie di nero la trasparenza: niente angoli vuoti.
  ['apple-touch-icon.png', fullBleed(0.9), 180],
  ['shortcut-nuova-spesa.png', shortcut(PLUS), 96],
  ['shortcut-lista.png', shortcut(SHOPPING_BASKET), 96],
]

function render(svg, size) {
  return sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer()
}

for (const [name, svg, size] of outputs) {
  const png = await render(svg, size)
  await writeFile(new URL(name, PUBLIC), png)
  console.log(`${name} ${size}×${size} (${png.length} byte)`)
}

// favicon.ico: un contenitore ICO con dentro PNG a 16, 32 e 48 px (formato
// che tutti i browser attuali leggono). Intestazione di 6 byte, una voce da
// 16 byte per immagine, poi i PNG uno dopo l'altro.
const sizes = [16, 32, 48]
const images = await Promise.all(sizes.map((size) => render(source, size)))
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
