/**
 * La scena delle bottiglie 3D. È l'unico posto dell'app che importa three.js,
 * e lo si raggiunge solo da `components/chores/ChoreBottles3D.tsx`, caricato
 * con `next/dynamic` quando qualcuno sceglie la vista 3D: chi resta sul 2D non
 * scarica niente di tutto questo.
 *
 * Cosa fa: due bottiglie di vetro allineate in alto, con le scritte stampate
 * sul vetro, il liquido disegnato come volume (shader in `shaders.ts`) e la
 * fisica di `lib/chores/liquid3d.ts`. Si girano col dito (arcball attorno al
 * centro della bottiglia) e, lasciate, tornano dritte; il liquido resta
 * orizzontale, sciaborda, segue i sensori del telefono (`device-tilt.ts`,
 * gli stessi del 2D) e si riempie versando.
 *
 * Pensata per il telefono:
 * - il ciclo `requestAnimationFrame` gira solo finché qualcosa si muove, e
 *   mai a riquadro fuori dallo schermo;
 * - se i fotogrammi arrivano lenti, la risoluzione scende da sola;
 * - niente MSAA sugli schermi densi, texture delle scritte a misura;
 * - `dispose` libera tutto e perde il contesto: tornando al 2D la GPU è
 *   libera subito.
 *
 * Come in 2D l'animazione non decide niente: il livello viene sempre dalle
 * tacche piene.
 */
import {
  AddEquation,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  CustomBlending,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  FrontSide,
  Group,
  HalfFloatType,
  LatheGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  Matrix3,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Quaternion,
  Raycaster,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  type IUniform,
  type Side,
} from 'three'
import type { Notch } from '../bottle'
import { readTilt, watchTilt } from '../device-tilt'
import {
  BASE_T,
  BOTTLE_X,
  BOTTOM_R,
  CAP_H,
  CAP_R,
  clearWaves,
  createVessel,
  createWaves,
  forceWaves,
  framing,
  GLASS_T,
  GRAVITY,
  HALF_WIDTH,
  INNER_R,
  kickWaves,
  levelVolume,
  NECK_H,
  NECK_R,
  NOTCH_H,
  OUTER_R,
  packWaves,
  sampleWaves,
  settleWaves,
  SHOULDER_H,
  slopeFromUp,
  solveLevel,
  stepWaves,
  WAVE_CELLS,
  WAVE_REST,
  waveSpeed,
  type Vessel,
  type Waves,
} from '../liquid3d'
import {
  FS_CAP,
  FS_GLASS,
  FS_LIQUID,
  FS_POINTS,
  FS_SHADOW,
  FS_STREAM,
  VS_CAP,
  VS_LIQUID,
  VS_POINTS,
  VS_SHADOW,
  VS_STREAM,
  VS_WORLD,
} from './shaders'

/** Il canvas sborda di tanto per lato nei margini della pagina: una bottiglia inclinata ha spazio. */
export const BLEED_PX = 16

export interface SceneBottle {
  notches: Notch[]
}

export interface BottleSceneOptions {
  /** Tocco breve sul vetro di una bottiglia, all'altezza di una tacca (dal basso). */
  onTap: (bottle: number, notch: number) => void
  /** Dove scrivere il nome di ogni bottiglia, in px dal riquadro (senza il margine in cui sborda). */
  onLayout: (names: { x: number; y: number }[]) => void
  /** Il telefono ha tolto il contesto WebGL (succede in background su iOS). */
  onContextLost: () => void
}

export interface BottleScene {
  setBottles(bottles: SceneBottle[]): void
  setFont(family: string): void
  refreshTheme(): void
  setReducedMotion(reduced: boolean): void
  setVisible(visible: boolean): void
  resize(): void
  dispose(): void
}

const ELEVATION = MathUtils.degToRad(12)
const FOV = 18
const SUB_DT = 1 / 240
const DENSITY = 1.8
/** Secondi per versare una tacca, e per toglierla. */
const POUR_TIME = 0.55
const DRAIN_TIME = 0.35
/** ~32°: oltre, una bottiglia uscirebbe dallo schermo. */
const MAX_TILT = 0.55
const KEY_DIR = new Vector3(-0.85, 0.35, 0.4).normalize()
const MAX_PARTICLES = 60
/** Le scritte: la circonferenza esterna a 256 px per unità, una tacca alta 128 px. */
const TEX_W = 1440
const NOTCH_PX = 128

const tmpV = new Vector3()
const tmpV2 = new Vector3()
const tmpQ = new Quaternion()
const tmpQ2 = new Quaternion()

/** q = swing · twist, con il twist attorno all'asse della bottiglia. Restituisce l'angolo del twist. */
function decompose(q: Quaternion, outSwing: Quaternion, outTwist: Quaternion): number {
  const len = Math.hypot(q.y, q.w)
  if (len < 1e-8) outTwist.set(0, 0, 0, 1)
  else outTwist.set(0, q.y / len, 0, q.w / len)
  outSwing.copy(q).multiply(tmpQ2.copy(outTwist).conjugate())
  return 2 * Math.atan2(outTwist.y, outTwist.w)
}

function quatAngle(q: Quaternion): number {
  return 2 * Math.acos(Math.min(1, Math.abs(q.w)))
}

interface Particle {
  /** 0 bolla, 1 goccia */
  kind: 0 | 1
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  age: number
}

/* ─── Colori ─────────────────────────────────────────────────────────── */

type Rgb = [number, number, number]

function hexToRgb(value: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(value.trim())
  if (!m) return [0.5, 0.5, 0.5]
  const v = parseInt(m[1], 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}
/** Come `color-mix(in srgb, a, b t%)`. */
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i] * (1 - t) + b[i] * t) as Rgb
const linear = (c: Rgb): Rgb => c.map((x) => Math.pow(x, 2.2)) as Rgb
const WHITE: Rgb = [1, 1, 1]

function vec3(): IUniform<Vector3> {
  return { value: new Vector3() }
}
function vec4(): IUniform<Vector4> {
  return { value: new Vector4() }
}
function setLin(u: IUniform<Vector3>, c: Rgb) {
  const l = linear(c)
  u.value.set(l[0], l[1], l[2])
}
function setLinA(u: IUniform<Vector4>, c: Rgb, a: number) {
  const l = linear(c)
  u.value.set(l[0], l[1], l[2], a)
}

/* ─── Geometrie ──────────────────────────────────────────────────────── */

function glassProfile(bodyH: number): Vector2[] {
  const pts = [new Vector2(0.0001, -BASE_T)]
  const rco = BOTTOM_R + GLASS_T
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * (Math.PI / 2)
    pts.push(new Vector2(OUTER_R - rco + rco * Math.cos(a), -BASE_T + rco + rco * Math.sin(a)))
  }
  const y0 = -BASE_T + rco
  const rows = Math.max(2, Math.round(bodyH / 0.25))
  for (let i = 1; i <= rows; i++) pts.push(new Vector2(OUTER_R, y0 + ((bodyH - y0) * i) / rows))
  const neckO = NECK_R + GLASS_T
  for (let i = 1; i <= 20; i++) {
    const t = i / 20
    pts.push(new Vector2(neckO + (OUTER_R - neckO) * (0.5 + 0.5 * Math.cos(Math.PI * t)), bodyH + t * SHOULDER_H))
  }
  pts.push(new Vector2(neckO, bodyH + SHOULDER_H + NECK_H))
  return pts
}

function capProfile(bodyH: number): Vector2[] {
  const yTop = bodyH + SHOULDER_H + NECK_H + 0.08
  const yBot = yTop - CAP_H
  const bevel = 0.04
  const pts = [new Vector2(NECK_R + GLASS_T + 0.01, yBot), new Vector2(CAP_R, yBot)]
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2)
    pts.push(new Vector2(CAP_R - bevel + bevel * Math.cos(a), yTop - bevel + bevel * Math.sin(a)))
  }
  pts.push(new Vector2(0.0001, yTop))
  return pts
}

function blendedMaterial(params: {
  uniforms: Record<string, IUniform>
  vertexShader: string
  fragmentShader: string
  side?: Side
}): ShaderMaterial {
  return new ShaderMaterial({
    ...params,
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
  })
}

/* ─── Le scritte sul vetro ───────────────────────────────────────────── */

function drawHouse(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.lineWidth = s * 0.13
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-s * 0.45, -s * 0.02)
  ctx.lineTo(0, -s * 0.45)
  ctx.lineTo(s * 0.45, -s * 0.02)
  ctx.moveTo(-s * 0.33, -s * 0.12)
  ctx.lineTo(-s * 0.33, s * 0.42)
  ctx.lineTo(s * 0.33, s * 0.42)
  ctx.lineTo(s * 0.33, -s * 0.12)
  ctx.moveTo(-s * 0.1, s * 0.42)
  ctx.lineTo(-s * 0.1, s * 0.12)
  ctx.lineTo(s * 0.1, s * 0.12)
  ctx.lineTo(s * 0.1, s * 0.42)
  ctx.stroke()
  ctx.restore()
}

function drawBulb(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.lineWidth = s * 0.12
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, -s * 0.12, s * 0.3, Math.PI * 0.8, Math.PI * 2.2)
  ctx.lineTo(s * 0.13, s * 0.22)
  ctx.lineTo(-s * 0.13, s * 0.22)
  ctx.closePath()
  ctx.moveTo(-s * 0.12, s * 0.38)
  ctx.lineTo(s * 0.12, s * 0.38)
  ctx.stroke()
  ctx.restore()
}

function drawPlus(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save()
  ctx.lineWidth = s * 0.14
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - s / 2, y)
  ctx.lineTo(x + s / 2, y)
  ctx.moveTo(x, y - s / 2)
  ctx.lineTo(x, y + s / 2)
  ctx.stroke()
  ctx.restore()
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t.trimEnd() + '…'
}

/** Cosa c'è scritto su una bottiglia: se non cambia, la texture non si ridisegna. */
function labelKey(notches: Notch[], font: string): string {
  return font + '|' + notches.map((n) => `${n.bonus ? 1 : 0}:${n.entry?.name ?? ''}:${n.hint?.name ?? ''}`).join('|')
}

/**
 * Tre maschere in una texture: R i nomi (e la casa del bonus), G il tratteggio
 * delle tacche tutto attorno, B suggerimenti, «+» e bonus vuoto. I colori li
 * sceglie lo shader, secondo cosa c'è dietro il vetro.
 */
function drawLabels(canvas: HTMLCanvasElement, notches: Notch[], font: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width
  const H = canvas.height
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'lighter'

  ctx.strokeStyle = '#00ff00'
  ctx.lineWidth = 2
  ctx.setLineDash([12, 8])
  for (let i = 1; i < notches.length; i++) {
    const y = H - i * NOTCH_PX
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  ctx.setLineDash([])

  const firstEmpty = notches.findIndex((n) => !n.entry && !n.hint)
  const cx = W / 2
  const maxW = W * 0.27 // circa ±50° attorno al davanti
  ctx.textBaseline = 'middle'
  notches.forEach((n, i) => {
    const cy = H - (i + 0.5) * NOTCH_PX
    ctx.textAlign = 'left'
    if (n.entry) {
      ctx.fillStyle = ctx.strokeStyle = '#ff0000'
      ctx.font = `700 31px ${font}`
      const icon = n.bonus ? 34 : 0
      const text = fitText(ctx, n.entry.name, maxW - icon)
      const x0 = cx - (ctx.measureText(text).width + icon) / 2
      if (n.bonus) drawHouse(ctx, x0 + 12, cy, 23)
      ctx.fillText(text, x0 + icon, cy + 1)
    } else if (n.hint) {
      ctx.font = `600 29px ${font}`
      const text = fitText(ctx, n.hint.name, maxW - 40)
      const tw = ctx.measureText(text).width
      const bw = tw + 70
      const bh = NOTCH_PX * 0.74
      ctx.fillStyle = 'rgb(0,0,46)'
      ctx.strokeStyle = '#0000ff'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 6])
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 20)
      else ctx.rect(cx - bw / 2, cy - bh / 2, bw, bh)
      ctx.fill()
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = ctx.strokeStyle = '#0000ff'
      const x0 = cx - (tw + 35) / 2
      drawBulb(ctx, x0 + 12, cy, 24)
      ctx.fillText(text, x0 + 35, cy + 1)
    } else if (i === firstEmpty) {
      ctx.fillStyle = ctx.strokeStyle = '#0000ff'
      if (n.bonus) {
        ctx.font = `600 28px ${font}`
        drawHouse(ctx, cx - 41, cy, 25)
        ctx.fillText('bonus', cx - 23, cy + 1)
      } else {
        drawPlus(ctx, cx, cy, 29)
      }
    } else if (n.bonus) {
      ctx.strokeStyle = 'rgb(0,0,110)'
      drawHouse(ctx, cx, cy, 25)
    }
  })
}

/* ─── La scena ───────────────────────────────────────────────────────── */

export function createBottleScene(
  canvas: HTMLCanvasElement,
  stage: HTMLElement,
  options: BottleSceneOptions,
): BottleScene {
  const deviceRatio = Math.min(window.devicePixelRatio || 1, 2)
  // Su uno schermo denso l'antialiasing costa molto e si vede poco.
  const renderer = new WebGLRenderer({
    canvas,
    antialias: deviceRatio < 2,
    alpha: true,
    premultipliedAlpha: true,
    powerPreference: 'default',
  })
  renderer.setClearColor(0x000000, 0)
  const maxAniso = renderer.capabilities.getMaxAnisotropy()

  const scene = new Scene()
  const camera = new PerspectiveCamera(FOV, 1, 0.5, 60)
  const raycaster = new Raycaster()
  const ndc = new Vector2()

  let reduced = false
  let visible = true
  let disposed = false
  let font = 'sans-serif'
  let pixelRatio = deviceRatio
  let viewW = 1
  let viewH = 1
  let frame = 0
  let last = 0
  let slowFrames = 0
  let jolt = readTilt().jolt
  let unwatchTilt: () => void = () => {}

  // Uniform condivisi da tutte le bottiglie: i colori del tema.
  const U = {
    uRoom: vec3(),
    uRoomRefl: { value: 1 },
    uShine: vec3(),
    uTint: vec3(),
    uLiqTop: vec3(),
    uLiqDeep: vec3(),
    uBonTop: vec3(),
    uBonDeep: vec3(),
    uInkDry: vec4(),
    uInkMain: vec4(),
    uInkBonus: vec4(),
    uLineDry: vec4(),
    uLineMain: vec4(),
    uLineBonus: vec4(),
    uSubDry: vec4(),
    uSubMain: vec4(),
    uSubBonus: vec4(),
    uCapCol: vec3(),
    uCausticCol: vec3(),
    uDensity: { value: DENSITY },
  }
  let streamColors = { main: new Vector3(), bonus: new Vector3() }

  function refreshTheme() {
    const cs = getComputedStyle(document.documentElement)
    const tok = (name: string) => hexToRgb(cs.getPropertyValue(name))
    const bg = tok('--background')
    const fg = tok('--foreground')
    const accent = tok('--accent')
    const accentFg = tok('--accent-foreground')
    const accentMuted = tok('--accent-muted')
    const accentSoft = tok('--accent-soft')
    const borderStrong = tok('--border-strong')
    const dark = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2] < 0.4
    // Le stesse mescolanze delle bottiglie 2D (`LIQUID_SHADE` in liquid.ts).
    setLin(U.uLiqTop, accent)
    setLin(U.uLiqDeep, mixRgb(accent, accentSoft, 0.3))
    setLin(U.uBonTop, accentMuted)
    setLin(U.uBonDeep, mixRgb(accentMuted, accent, 0.12))
    setLin(U.uShine, mixRgb(accent, WHITE, 0.55))
    // Su fondo chiaro il vetro si legge dai bordi scuri; su fondo scuro dai riflessi.
    setLin(U.uTint, dark ? borderStrong : mixRgb(borderStrong, fg, 0.35))
    setLin(U.uRoom, bg)
    U.uRoomRefl.value = dark ? 1 : 0.45
    setLin(U.uCapCol, accentMuted)
    setLin(U.uCausticCol, mixRgb(accent, WHITE, 0.35))
    setLinA(U.uInkDry, fg, 1)
    setLinA(U.uInkMain, accentFg, 1)
    setLinA(U.uInkBonus, accentSoft, 1)
    setLinA(U.uLineDry, borderStrong, 0.6)
    setLinA(U.uLineMain, accentFg, 0.25)
    setLinA(U.uLineBonus, accentSoft, 0.25)
    setLinA(U.uSubDry, accentSoft, 0.72)
    setLinA(U.uSubMain, accentFg, 0.8)
    setLinA(U.uSubBonus, accentSoft, 0.8)
    const main = linear(accent)
    const bonus = linear(accentMuted)
    streamColors = { main: new Vector3(...main), bonus: new Vector3(...bonus) }
    for (const b of bottles) b.u.uDrop.value.copy(streamColors.main)
    render()
  }

  /* — Una bottiglia — */

  class Bottle {
    readonly notches: number
    readonly bodyH: number
    readonly vessel: Vessel
    readonly waves: Waves
    readonly group = new Group()
    readonly model = new Group()
    readonly u: Record<string, IUniform> & {
      uDrop: IUniform<Vector3>
      uScale: IUniform<number>
      uColor: IUniform<Vector3>
    }
    readonly glassFront: Mesh
    readonly shadow: Mesh<PlaneGeometry, ShaderMaterial>
    readonly streamMesh: Mesh<BufferGeometry, ShaderMaterial>
    readonly points: Points<BufferGeometry, ShaderMaterial>
    private readonly disposables: { dispose(): void }[] = []
    private readonly labelCanvas = document.createElement('canvas')
    private readonly labelTex: CanvasTexture
    private readonly waveData: Uint16Array
    private readonly waveTex: DataTexture
    private labels = ''
    private notchList: Notch[] = []

    omega = new Vector3()
    dragging = false
    swing = new Quaternion()
    twistQ = new Quaternion()
    twist = 0
    private slope = { x: 0, z: 0 }
    private slopeReady = false
    private dev = { x: 0, z: 0 }
    private devV = { x: 0, z: 0 }
    private cTop = -10
    private cIf = -10
    private vb = 0
    private vm = 0
    private tb = 0
    private tm = 0
    private readonly notchVol: number
    private stream: {
      topY: number
      headY: number
      headV: number
      tailY: number | null
      tailV: number
      flowing: boolean
      bonus: boolean
      t: number
      spawn: number
    } | null = null
    private particles: Particle[] = []
    private accel = new Vector3()
    private prevC: Vector3 | null = null
    private prevVel = new Vector3()
    private cacheKey = ''
    private acc = 0
    private readonly pPos = new Float32Array(MAX_PARTICLES * 3)
    private readonly pSize = new Float32Array(MAX_PARTICLES)
    private readonly pKind = new Float32Array(MAX_PARTICLES)
    private readonly streamRings = 26
    private readonly streamSeg = 12
    private readonly sPos: Float32Array

    constructor(notches: Notch[], readonly order: number, readonly baseX: number, topY: number) {
      this.notches = notches.length
      this.bodyH = this.notches * NOTCH_H
      this.vessel = createVessel(this.notches)
      this.waves = createWaves(WAVE_CELLS)
      this.waveData = new Uint16Array(WAVE_CELLS * WAVE_CELLS * 4)
      this.waveTex = new DataTexture(this.waveData, WAVE_CELLS, WAVE_CELLS, RGBAFormat, HalfFloatType)
      this.waveTex.magFilter = LinearFilter
      this.waveTex.minFilter = LinearFilter
      this.waveTex.wrapS = this.waveTex.wrapT = ClampToEdgeWrapping
      this.waveTex.needsUpdate = true

      const pivotY = this.bodyH * 0.5 + 0.15
      this.group.position.set(baseX, topY - this.bodyH + pivotY, 0)
      this.model.position.set(0, -pivotY, 0)
      this.group.add(this.model)
      scene.add(this.group)

      this.labelCanvas.width = TEX_W
      this.labelCanvas.height = this.notches * NOTCH_PX
      this.labelTex = new CanvasTexture(this.labelCanvas)
      this.labelTex.wrapS = RepeatWrapping
      this.labelTex.wrapT = ClampToEdgeWrapping
      this.labelTex.minFilter = LinearMipmapLinearFilter
      this.labelTex.anisotropy = Math.min(maxAniso, 8)

      this.u = {
        uH: { value: this.bodyH },
        uRI: { value: INNER_R },
        uRO: { value: OUTER_R },
        uGT: { value: GLASS_T },
        uYTop: { value: this.bodyH + SHOULDER_H },
        uPlane: { value: new Vector3(-10, 0, 0) },
        uIface: { value: new Vector3(-10, 0, 0) },
        uTwist: { value: new Vector2(1, 0) },
        uWave: { value: this.waveTex },
        uLabels: { value: this.labelTex },
        uCam: { value: new Vector3() },
        uRotW: { value: new Matrix3() },
        uKeyM: { value: new Vector3() },
        uHasLiquid: { value: 0 },
        uHasBonus: { value: 0 },
        uLayerH: { value: new Vector2(1, 0.5) },
        uScale: { value: 400 },
        uDrop: { value: streamColors.main.clone() },
        uColor: { value: new Vector3() },
      }
      const uni = (extra: Record<string, IUniform> = {}) => ({ ...U, ...this.u, ...extra })

      const glassGeo = new LatheGeometry(glassProfile(this.bodyH), 72)
      const glassBack = new Mesh(glassGeo, blendedMaterial({
        uniforms: uni({ uBack: { value: 1 } }), vertexShader: VS_WORLD, fragmentShader: FS_GLASS, side: BackSide,
      }))
      this.glassFront = new Mesh(glassGeo, blendedMaterial({
        uniforms: uni({ uBack: { value: 0 } }), vertexShader: VS_WORLD, fragmentShader: FS_GLASS, side: FrontSide,
      }))
      const yTop = this.bodyH + SHOULDER_H
      const liquidGeo = new CylinderGeometry(INNER_R * 1.003, INNER_R * 1.003, yTop, 56, 1, false)
      liquidGeo.translate(0, yTop / 2, 0)
      const liquid = new Mesh(liquidGeo, blendedMaterial({
        uniforms: uni(), vertexShader: VS_LIQUID, fragmentShader: FS_LIQUID, side: FrontSide,
      }))
      const capGeo = new LatheGeometry(capProfile(this.bodyH), 48)
      const cap = new Mesh(capGeo, new ShaderMaterial({ uniforms: uni(), vertexShader: VS_CAP, fragmentShader: FS_CAP }))

      const pGeo = new BufferGeometry()
      pGeo.setAttribute('position', new BufferAttribute(this.pPos, 3))
      pGeo.setAttribute('aSize', new BufferAttribute(this.pSize, 1))
      pGeo.setAttribute('aKind', new BufferAttribute(this.pKind, 1))
      pGeo.setDrawRange(0, 0)
      this.points = new Points(pGeo, blendedMaterial({ uniforms: uni(), vertexShader: VS_POINTS, fragmentShader: FS_POINTS }))
      this.points.frustumCulled = false

      // Il getto: un tubo nel mondo (cade dritto qualunque sia l'inclinazione), ridisegnato a ogni fotogramma.
      this.sPos = new Float32Array(this.streamRings * this.streamSeg * 3)
      const sNor = new Float32Array(this.streamRings * this.streamSeg * 3)
      const idx: number[] = []
      for (let j = 0; j < this.streamRings; j++) {
        for (let k = 0; k < this.streamSeg; k++) {
          const a = (k / this.streamSeg) * Math.PI * 2
          const o = (j * this.streamSeg + k) * 3
          sNor[o] = Math.sin(a)
          sNor[o + 2] = Math.cos(a)
          if (j < this.streamRings - 1) {
            const k2 = (k + 1) % this.streamSeg
            const A = j * this.streamSeg + k
            const B = j * this.streamSeg + k2
            const C = (j + 1) * this.streamSeg + k
            const D = (j + 1) * this.streamSeg + k2
            idx.push(A, C, B, B, C, D)
          }
        }
      }
      const sGeo = new BufferGeometry()
      sGeo.setAttribute('position', new BufferAttribute(this.sPos, 3))
      sGeo.setAttribute('normal', new BufferAttribute(sNor, 3))
      sGeo.setIndex(idx)
      this.streamMesh = new Mesh(sGeo, blendedMaterial({
        uniforms: uni(), vertexShader: VS_STREAM, fragmentShader: FS_STREAM, side: DoubleSide,
      }))
      this.streamMesh.frustumCulled = false
      this.streamMesh.visible = false
      scene.add(this.streamMesh)

      this.shadow = new Mesh(new PlaneGeometry(2.6, 1.7), blendedMaterial({
        uniforms: { ...U, uShadow: { value: 0.24 }, uCaustic: { value: 0.3 } },
        vertexShader: VS_SHADOW,
        fragmentShader: FS_SHADOW,
      }))
      this.shadow.rotation.x = -Math.PI / 2
      this.shadow.position.set(baseX, topY - this.bodyH - BASE_T - 0.004, 0)
      scene.add(this.shadow)

      // Ordine: ombre, vetro dietro, liquido, getto e bolle, vetro davanti.
      const base = 10 + order * 10
      this.shadow.renderOrder = 1
      glassBack.renderOrder = base + 1
      liquid.renderOrder = base + 2
      this.streamMesh.renderOrder = base + 3
      this.points.renderOrder = base + 4
      this.glassFront.renderOrder = base + 5
      this.model.add(glassBack, liquid, this.points, this.glassFront, cap)

      this.disposables.push(
        glassGeo, liquidGeo, capGeo, pGeo, sGeo, this.shadow.geometry,
        glassBack.material, this.glassFront.material as ShaderMaterial, liquid.material, cap.material,
        this.points.material, this.streamMesh.material, this.shadow.material,
        this.labelTex, this.waveTex,
      )

      this.notchVol = levelVolume(this.vessel, NOTCH_H * 2) - levelVolume(this.vessel, NOTCH_H)
      this.setNotches(notches)
      // All'apertura il liquido c'è già: niente travaso di benvenuto, solo un piccolo assestamento.
      this.vb = this.tb
      this.vm = this.tm
      if (!reduced) {
        this.dev.x = 0.04
        forceWaves(this.waves, 0.02, 0.008)
      }
    }

    get total() {
      return this.vb + this.vm
    }

    setNotches(notches: Notch[]) {
      this.notchList = notches
      this.drawLabels()
      const filled = notches.filter((n) => n.entry).length
      const bonus = notches.filter((n) => n.entry && n.bonus).length
      this.tb = levelVolume(this.vessel, bonus * NOTCH_H)
      this.tm = levelVolume(this.vessel, filled * NOTCH_H) - this.tb
    }

    drawLabels() {
      const key = labelKey(this.notchList, font)
      if (key === this.labels) return
      this.labels = key
      drawLabels(this.labelCanvas, this.notchList, font)
      this.labelTex.needsUpdate = true
    }

    private toLiquid(x: number, z: number): [number, number] {
      const c = Math.cos(this.twist)
      const s = Math.sin(this.twist)
      return [x * c + z * s, -x * s + z * c]
    }

    private surfaceAt(x: number, z: number): number {
      const [qx, qz] = this.toLiquid(x, z)
      return this.cTop + this.slope.x * qx + this.slope.z * qz + sampleWaves(this.waves, qx, qz)
    }

    ripple(x: number, z: number, amount: number) {
      if (reduced || this.total < 1e-4) return
      const [qx, qz] = this.toLiquid(x, z)
      const r = Math.hypot(qx, qz)
      const k = r > INNER_R * 0.85 ? (INNER_R * 0.85) / r : 1
      kickWaves(this.waves, qx * k, qz * k, amount, 0.12)
    }

    joltRandom(amount: number) {
      if (reduced || this.total < 1e-4) return
      const a = Math.random() * Math.PI * 2
      forceWaves(this.waves, Math.cos(a) * amount * 0.12, Math.sin(a) * amount * 0.12)
      this.ripple(Math.cos(a) * 0.4, Math.sin(a) * 0.4, -amount * 2)
    }

    /** Il corpo rigido: trascinato, o libero con una molla che lo raddrizza e lo rigira verso chi guarda. */
    private updateBody(dt: number): boolean {
      if (this.dragging) return true
      const q = this.group.quaternion
      this.twist = decompose(q, this.swing, this.twistQ)
      const axis = tmpV.set(0, 1, 0).applyQuaternion(q)
      const spin = this.omega.dot(axis)
      const sw = tmpQ.copy(this.swing)
      if (sw.w < 0) sw.set(-sw.x, -sw.y, -sw.z, -sw.w)
      const ang = quatAngle(sw)
      const sinH = Math.sqrt(Math.max(1 - sw.w * sw.w, 0))
      const torque = tmpV2.set(0, 0, 0)
      if (sinH > 1e-6) torque.set(sw.x / sinH, sw.y / sinH, sw.z / sinH).multiplyScalar(ang)
      const k = this.stream ? 160 : 70
      const damping = reduced ? 2 * Math.sqrt(k) : 5.2
      const perp = this.omega.clone().addScaledVector(axis, -spin)
      torque.multiplyScalar(-k).addScaledVector(perp, -damping)
      // Attorno all'asse gira libera finché va forte, poi torna a mostrare le scritte.
      const err = Math.atan2(Math.sin(this.twist), Math.cos(this.twist))
      if (Math.abs(spin) < 1.8 || reduced) torque.addScaledVector(axis, -26 * err - 8 * spin)
      else torque.addScaledVector(axis, -0.6 * spin)
      this.omega.addScaledVector(torque, dt)
      const w = this.omega.length()
      if (w > 1e-7) {
        tmpQ.setFromAxisAngle(tmpV.copy(this.omega).divideScalar(w), w * dt)
        q.premultiply(tmpQ).normalize()
      }
      if (w < 0.004 && ang < 0.0015 && Math.abs(err) < 0.0015) {
        q.set(0, 0, 0, 1)
        this.omega.set(0, 0, 0)
        return false
      }
      return true
    }

    limitTilt() {
      const q = this.group.quaternion
      decompose(q, this.swing, this.twistQ)
      const sw = this.swing
      if (sw.w < 0) sw.set(-sw.x, -sw.y, -sw.z, -sw.w)
      if (quatAngle(sw) <= MAX_TILT) return
      const sinH = Math.sqrt(Math.max(1 - sw.w * sw.w, 0))
      sw.setFromAxisAngle(tmpV.set(sw.x / sinH, sw.y / sinH, sw.z / sinH), MAX_TILT)
      q.copy(sw).multiply(this.twistQ)
    }

    /** Un passo: gravità efficace, volumi, livelli, onde, getto, bolle. Dice se c'è ancora movimento. */
    update(dt: number, gravity: Vector3, joltNow: number): boolean {
      let active = this.updateBody(dt)
      this.group.updateMatrixWorld(true)
      this.twist = decompose(this.group.quaternion, this.swing, this.twistQ)

      // Il perno è al centro della bottiglia, il liquido più in basso: girandola, il liquido accelera.
      const c = this.model.localToWorld(tmpV.set(0, Math.max(this.cTop, 0.2) * 0.5, 0)).clone()
      if (this.prevC && dt > 0) {
        const vel = c.clone().sub(this.prevC).divideScalar(dt)
        const acc = vel.clone().sub(this.prevVel).divideScalar(dt)
        if (acc.length() > GRAVITY * 1.6) acc.setLength(GRAVITY * 1.6)
        this.accel.lerp(acc, Math.min(1, dt / 0.06))
        this.prevVel.copy(vel)
      }
      this.prevC = c
      if (reduced) this.accel.set(0, 0, 0)
      if (joltNow > 0) this.joltRandom(joltNow)

      const up = tmpV2.copy(gravity).sub(this.accel).negate().normalize()
        .applyQuaternion(tmpQ.copy(this.swing).invert())
      const { x: sx, z: sz } = slopeFromUp(up)
      if (!this.slopeReady) {
        this.slope = { x: sx, z: sz }
        this.slopeReady = true
      }
      const dsx = sx - this.slope.x
      const dsz = sz - this.slope.z
      this.slope = { x: sx, z: sz }
      if (!reduced && (Math.abs(dsx) > 1e-7 || Math.abs(dsz) > 1e-7)) {
        forceWaves(this.waves, dsx, dsz)
        this.dev.x -= dsx
        this.dev.z -= dsz
      }

      active = this.updateVolumes(dt) || active

      // Il confine tra i due liquidi oscilla più lento e più smorzato della superficie.
      if (reduced) {
        this.dev = { x: 0, z: 0 }
        this.devV = { x: 0, z: 0 }
      } else {
        const w = 5
        const zeta = 0.22
        for (const key of ['x', 'z'] as const) {
          this.devV[key] += (-w * w * this.dev[key] - 2 * zeta * w * this.devV[key]) * dt
          this.dev[key] = Math.max(-1.2, Math.min(1.2, this.dev[key] + this.devV[key] * dt))
        }
        if (Math.abs(this.dev.x) + Math.abs(this.dev.z) > 2e-4 || Math.abs(this.devV.x) + Math.abs(this.devV.z) > 2e-3) active = true
        else {
          this.dev = { x: 0, z: 0 }
          this.devV = { x: 0, z: 0 }
        }
      }

      // I livelli a volume costante: si ricalcolano solo se qualcosa è cambiato.
      const total = this.total
      const key = `${total.toFixed(5)}|${this.vb.toFixed(5)}|${sx.toFixed(4)}|${sz.toFixed(4)}|${this.dev.x.toFixed(4)}|${this.dev.z.toFixed(4)}`
      if (key !== this.cacheKey) {
        this.cacheKey = key
        this.cTop = solveLevel(this.vessel, total, sx, sz)
        this.cIf = this.vb > 1e-4 ? solveLevel(this.vessel, this.vb, sx + this.dev.x, sz + this.dev.z) : -10
      }

      const depth = Math.max(this.cTop, 0)
      if (reduced || total < 1e-4 || depth < 0.04) {
        if (this.waves.awake) this.clearWaves()
      } else if (this.waves.awake) {
        const speed = waveSpeed(depth)
        this.acc = Math.min(this.acc + dt, 0.1)
        while (this.acc >= SUB_DT) {
          this.acc -= SUB_DT
          if (this.stream?.flowing) this.impact(SUB_DT)
          stepWaves(this.waves, SUB_DT, speed)
        }
        const amplitude = settleWaves(this.waves)
        if (amplitude < WAVE_REST && !this.stream?.flowing) this.clearWaves()
        else {
          packWaves(this.waves, this.waveData)
          this.waveTex.needsUpdate = true
          active = true
        }
      }

      active = this.updateStream(dt) || active
      active = this.updateParticles(dt) || active
      this.writeUniforms()
      return active
    }

    private clearWaves() {
      clearWaves(this.waves)
      this.waveData.fill(0)
      this.waveTex.needsUpdate = true
    }

    private updateVolumes(dt: number): boolean {
      const needB = this.tb - this.vb
      const needM = this.tm - this.vm
      const drain = (this.notchVol / DRAIN_TIME) * dt
      if (needB < -1e-6) this.vb = Math.max(this.tb, this.vb - drain)
      if (needM < -1e-6) this.vm = Math.max(this.tm, this.vm - drain)
      if (reduced) {
        this.vb = this.tb
        this.vm = this.tm
        if (this.stream) this.endStream()
        return false
      }
      const deficit = Math.max(needB, 0) + Math.max(needM, 0)
      if (deficit > 1e-6) {
        if (!this.stream) this.startStream()
        const s = this.stream!
        s.tailY = null
        s.bonus = needB > 1e-6
        if (s.flowing) {
          // Più faccende insieme si versano più in fretta.
          const rate = (this.notchVol / POUR_TIME) * (deficit > this.notchVol * 1.3 ? 1.8 : 1)
          const dv = rate * dt
          if (needB > 1e-6) this.vb += Math.min(dv, needB)
          else this.vm += Math.min(dv, needM)
        }
        return true
      }
      if (this.stream && this.stream.tailY == null) {
        this.stream.tailY = this.stream.topY
        this.stream.tailV = 0.4
      }
      return needB < -1e-6 || needM < -1e-6
    }

    private neckWorld(out: Vector3): Vector3 {
      return this.model.localToWorld(out.set(0, this.vessel.top - 0.05, 0))
    }

    private surfaceWorldY(): number {
      const y = this.total > 1e-4 ? this.surfaceAt(0, 0) : 0
      return this.model.localToWorld(tmpV.set(0, y, 0)).y
    }

    private startStream() {
      const top = this.neckWorld(new Vector3())
      this.stream = { topY: top.y, headY: top.y, headV: 0.8, tailY: null, tailV: 0, flowing: false, bonus: false, t: 0, spawn: 0 }
      this.streamMesh.visible = true
    }

    private endStream() {
      this.stream = null
      this.streamMesh.visible = false
    }

    private updateStream(dt: number): boolean {
      const s = this.stream
      if (!s) return false
      s.t += dt
      const top = this.neckWorld(new Vector3())
      s.topY = top.y
      const surfY = this.surfaceWorldY()
      if (!s.flowing) {
        s.headV += GRAVITY * dt
        s.headY -= s.headV * dt
        if (s.headY <= surfY) {
          s.flowing = true
          s.headY = surfY
          this.splash()
        }
      } else {
        s.headY = surfY
      }
      if (s.tailY != null) {
        s.tailV += GRAVITY * dt
        s.tailY -= s.tailV * dt
        if (s.tailY <= surfY + 0.01) {
          this.endStream()
          return true
        }
      }
      // Il tubo si assottiglia cadendo: la portata è la stessa, la velocità cresce.
      const yA = s.tailY ?? s.topY
      const yB = Math.min(s.headY, yA)
      const v0 = 1.1
      const r0 = 0.08
      const P = this.sPos
      for (let j = 0; j < this.streamRings; j++) {
        const y = yA + ((yB - yA) * j) / (this.streamRings - 1)
        const vel = Math.sqrt(v0 * v0 + 2 * GRAVITY * Math.max(s.topY - y, 0))
        let r = r0 * Math.sqrt(v0 / vel)
        if (j === 0 && s.tailY != null) r *= 0.6
        if (j === this.streamRings - 1 && !s.flowing) r *= 0.8
        const wobble = 0.006 * Math.sin(s.t * 31 + y * 9)
        for (let k = 0; k < this.streamSeg; k++) {
          const a = (k / this.streamSeg) * Math.PI * 2
          const o = (j * this.streamSeg + k) * 3
          P[o] = top.x + wobble + Math.sin(a) * r
          P[o + 1] = y
          P[o + 2] = top.z + Math.cos(a) * r
        }
      }
      this.streamMesh.geometry.attributes.position.needsUpdate = true
      this.u.uColor.value.copy(s.bonus ? streamColors.bonus : streamColors.main)
      return true
    }

    private impactPoint(): Vector3 {
      const p = this.neckWorld(new Vector3())
      p.y = this.stream?.headY ?? p.y
      return this.model.worldToLocal(p)
    }

    private impact(dt: number) {
      const s = this.stream
      if (!s) return
      const p = this.impactPoint()
      const [qx, qz] = this.toLiquid(p.x, p.z)
      kickWaves(this.waves, qx, qz, -9 * dt, 0.08)
      s.spawn += dt * 40
      while (s.spawn >= 1) {
        s.spawn -= 1
        this.addParticle(0, p.x + (Math.random() - 0.5) * 0.08, p.y - 0.02, p.z + (Math.random() - 0.5) * 0.08,
          (Math.random() - 0.5) * 0.5, -1.2 - Math.random() * 1.4, (Math.random() - 0.5) * 0.5, 0.022 + Math.random() * 0.03)
      }
    }

    private splash() {
      this.waves.awake = true
      const p = this.impactPoint()
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * Math.PI * 2
        const h = 0.6 + Math.random() * 0.9
        this.addParticle(1, p.x, p.y + 0.02, p.z, Math.cos(a) * h, 2.6 + Math.random() * 1.6, Math.sin(a) * h, 0.03 + Math.random() * 0.025)
      }
    }

    private addParticle(kind: 0 | 1, x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number) {
      if (this.particles.length < MAX_PARTICLES) this.particles.push({ kind, x, y, z, vx, vy, vz, size, age: 0 })
    }

    private updateParticles(dt: number): boolean {
      const g = this.points.geometry
      if (!this.particles.length) {
        g.setDrawRange(0, 0)
        return false
      }
      // "Su" nel riferimento della bottiglia: le bolle salgono dritte anche se è inclinata.
      const up = tmpV.set(0, 1, 0).applyQuaternion(tmpQ.copy(this.group.quaternion).invert())
      const keep: Particle[] = []
      for (const p of this.particles) {
        p.age += dt
        if (p.kind === 0) {
          // bolla: spinta di Archimede, attrito, un po' di tremolio
          p.vx += (up.x * 2.2 - p.vx * 3.2) * dt + (Math.random() - 0.5) * 5 * dt
          p.vy += (up.y * 2.2 - p.vy * 3.2) * dt
          p.vz += (up.z * 2.2 - p.vz * 3.2) * dt + (Math.random() - 0.5) * 5 * dt
        } else {
          p.vx -= up.x * GRAVITY * 0.6 * dt
          p.vy -= up.y * GRAVITY * 0.6 * dt
          p.vz -= up.z * GRAVITY * 0.6 * dt
        }
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        const r = Math.hypot(p.x, p.z)
        const lim = INNER_R - p.size - 0.02
        if (r > lim) {
          p.x *= lim / r
          p.z *= lim / r
          p.vx *= -0.3
          p.vz *= -0.3
        }
        if (p.y < p.size) {
          p.y = p.size
          p.vy = Math.abs(p.vy) * 0.2
        }
        const surface = this.surfaceAt(p.x, p.z)
        if (p.kind === 0) {
          if (p.y > surface - p.size * 0.6 || p.age > 4) continue // scoppia in superficie
        } else if (p.vy < 0 && p.y < surface) {
          this.ripple(p.x, p.z, -0.9)
          continue
        }
        keep.push(p)
      }
      this.particles = keep
      keep.forEach((p, i) => {
        this.pPos[i * 3] = p.x
        this.pPos[i * 3 + 1] = p.y
        this.pPos[i * 3 + 2] = p.z
        this.pSize[i] = p.size * 2
        this.pKind[i] = p.kind
      })
      g.setDrawRange(0, keep.length)
      g.attributes.position.needsUpdate = true
      g.attributes.aSize.needsUpdate = true
      g.attributes.aKind.needsUpdate = true
      return keep.length > 0
    }

    writeUniforms() {
      const u = this.u
      const total = this.total
      u.uHasLiquid.value = total > 1e-4 ? 1 : 0
      u.uHasBonus.value = this.vb > 1e-4 ? 1 : 0
      ;(u.uPlane.value as Vector3).set(total > 1e-4 ? this.cTop : -10, this.slope.x, this.slope.z)
      ;(u.uIface.value as Vector3).set(this.cIf, this.slope.x + this.dev.x, this.slope.z + this.dev.z)
      ;(u.uTwist.value as Vector2).set(Math.cos(this.twist), Math.sin(this.twist))
      ;(u.uLayerH.value as Vector2).set(Math.max(this.cTop - Math.max(this.cIf, 0), 0.3), Math.max(this.cIf, 0.25))
      this.model.updateMatrixWorld(true)
      this.model.worldToLocal((u.uCam.value as Vector3).copy(camera.position))
      ;(u.uRotW.value as Matrix3).setFromMatrix4(this.model.matrixWorld)
      ;(u.uKeyM.value as Vector3).copy(KEY_DIR).applyQuaternion(tmpQ.copy(this.group.quaternion).invert())
      // L'ombra segue il fondo ed è più tenue se la bottiglia è inclinata.
      const bottom = this.model.localToWorld(tmpV.set(0, -BASE_T, 0))
      this.shadow.position.x = bottom.x
      const tilt = quatAngle(this.swing)
      this.shadow.material.uniforms.uShadow.value = 0.24 * (1 - Math.min(tilt / MAX_TILT, 1) * 0.6)
      this.shadow.material.uniforms.uCaustic.value = 0.32 * Math.min(1, total / (this.notchVol * 2.5))
    }

    /** La tacca toccata, se il raggio colpisce il vetro di questa bottiglia. */
    hit(): { distance: number; notch: number; x: number; z: number } | null {
      const hits = raycaster.intersectObject(this.glassFront, false)
      if (!hits.length) return null
      const p = this.model.worldToLocal(hits[0].point.clone())
      return { distance: hits[0].distance, notch: p.y >= 0 && p.y < this.bodyH ? Math.floor(p.y / NOTCH_H) : -1, x: p.x, z: p.z }
    }

    dispose() {
      scene.remove(this.group, this.streamMesh, this.shadow)
      for (const d of this.disposables) d.dispose()
    }
  }

  /* — Disposizione e ciclo — */

  let bottles: Bottle[] = []
  let topY = 0

  function build(input: SceneBottle[]) {
    for (const b of bottles) b.dispose()
    const max = Math.max(...input.map((b) => b.notches.length), 1)
    topY = framing(max).topY
    bottles = input.map((b, i) => new Bottle(b.notches, i, (i - (input.length - 1) / 2) * 2 * BOTTLE_X, topY))
    layout()
  }

  function layout() {
    const stageW = Math.max(stage.clientWidth, 1)
    viewW = stageW + 2 * BLEED_PX
    viewH = Math.max(stage.clientHeight, 1)
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(viewW, viewH, false)
    camera.aspect = viewW / viewH
    const max = Math.max(...bottles.map((b) => b.notches), 1)
    const view = framing(max)
    const tanV = Math.tan(MathUtils.degToRad(FOV / 2))
    const dist = Math.max(view.halfHeight / tanV, (HALF_WIDTH * viewW) / stageW / (tanV * camera.aspect))
    camera.position.set(0, view.centerY + dist * Math.sin(ELEVATION), dist * Math.cos(ELEVATION))
    camera.lookAt(0, view.centerY, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    const scale = (viewH * pixelRatio) / (2 * tanV)
    for (const b of bottles) {
      b.u.uScale.value = scale
      b.writeUniforms()
    }
    options.onLayout(bottles.map((b) => {
      const v = tmpV.set(b.baseX, topY + SHOULDER_H + NECK_H + 0.38, 0).project(camera)
      return { x: ((v.x + 1) / 2) * viewW - BLEED_PX, y: ((1 - v.y) / 2) * viewH }
    }))
    render()
  }

  function render() {
    if (!disposed) renderer.render(scene, camera)
  }

  const gravity = new Vector3(0, -GRAVITY, 0)

  function tick(now: number) {
    frame = 0
    const dt = last ? Math.min(Math.max((now - last) / 1000, 0), 1 / 30) : 1 / 60
    // Se il telefono fatica (sotto i ~38 fps per un po'), si disegna con meno pixel.
    if (last && now - last > 26 && pixelRatio > 1) {
      if (++slowFrames > 40) {
        slowFrames = 0
        pixelRatio = Math.max(1, pixelRatio - 0.25)
        layout()
      }
    } else if (slowFrames > 0) slowFrames--
    last = now

    let tiltJolt = 0
    if (!reduced) {
      const reading = readTilt()
      gravity.set(Math.sin(reading.tilt), -Math.cos(reading.tilt), 0).multiplyScalar(GRAVITY)
      tiltJolt = reading.jolt - jolt
      jolt = reading.jolt
    } else gravity.set(0, -GRAVITY, 0)

    let active = pointer.id !== null
    for (const b of bottles) active = b.update(dt, gravity, tiltJolt) || active
    render()
    if (active && visible && !disposed) frame = requestAnimationFrame(tick)
    else last = 0
  }

  function wake() {
    if (frame || !visible || disposed) return
    frame = requestAnimationFrame(tick)
  }

  /* — Trascinare (arcball), toccare — */

  const pointer = {
    id: null as number | null,
    bottle: null as Bottle | null,
    x: 0,
    y: 0,
    t0: 0,
    moved: 0,
    lastMove: 0,
    vel: new Vector3(),
  }

  function localXY(e: PointerEvent): [number, number] {
    const rect = canvas.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
  }

  function screenOf(v: Vector3): [number, number] {
    const p = tmpV.copy(v).project(camera)
    return [((p.x + 1) / 2) * viewW, ((1 - p.y) / 2) * viewH]
  }

  function arcVec(b: Bottle, x: number, y: number): Vector3 {
    const [cx, cy] = screenOf(b.group.position)
    const [, top] = screenOf(tmpV2.set(b.baseX, topY + SHOULDER_H, 0))
    const R = Math.max(Math.abs(cy - top) * 1.05, 40)
    const px = (x - cx) / R
    const py = -(y - cy) / R
    const d2 = px * px + py * py
    const z = d2 <= 0.5 ? Math.sqrt(1 - d2) : 0.5 / Math.sqrt(d2)
    return new Vector3(px, py, z).normalize()
  }

  function onPointerDown(e: PointerEvent) {
    if (pointer.id !== null || !bottles.length) return
    const [x, y] = localXY(e)
    let best = bottles[0]
    let bestD = Infinity
    for (const b of bottles) {
      const d = Math.abs(screenOf(b.group.position)[0] - x)
      if (d < bestD) {
        bestD = d
        best = b
      }
    }
    pointer.id = e.pointerId
    pointer.bottle = best
    pointer.x = x
    pointer.y = y
    pointer.t0 = pointer.lastMove = performance.now()
    pointer.moved = 0
    pointer.vel.set(0, 0, 0)
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {}
    wake()
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerId !== pointer.id || !pointer.bottle) return
    const [x, y] = localXY(e)
    const b = pointer.bottle
    pointer.moved += Math.hypot(x - pointer.x, y - pointer.y)
    if (pointer.moved > 6 && !b.dragging) {
      b.dragging = true
      b.omega.set(0, 0, 0)
    }
    if (b.dragging) {
      const v1 = arcVec(b, pointer.x, pointer.y)
      const v2 = arcVec(b, x, y)
      const axis = new Vector3().crossVectors(v1, v2)
      const len = axis.length()
      if (len > 1e-6) {
        const angle = Math.atan2(len, v1.dot(v2)) * 1.25
        axis.divideScalar(len).applyQuaternion(camera.quaternion)
        b.group.quaternion.premultiply(tmpQ.setFromAxisAngle(axis, angle)).normalize()
        b.limitTilt()
        const now = performance.now()
        const dt = Math.max((now - pointer.lastMove) / 1000, 1 / 240)
        pointer.vel.multiplyScalar(0.5).addScaledVector(axis, (angle / dt) * 0.5)
        pointer.lastMove = now
      }
    }
    pointer.x = x
    pointer.y = y
  }

  function endPointer(e: PointerEvent, cancelled: boolean) {
    if (e.pointerId !== pointer.id || !pointer.bottle) return
    const b = pointer.bottle
    const [x, y] = localXY(e)
    if (b.dragging) {
      b.dragging = false
      const idle = performance.now() - pointer.lastMove > 90
      b.omega.copy(idle ? tmpV.set(0, 0, 0) : pointer.vel)
      if (b.omega.length() > 14) b.omega.setLength(14)
    } else if (!cancelled && pointer.moved <= 6 && performance.now() - pointer.t0 < 600) {
      tapAt(x, y)
    }
    pointer.id = null
    pointer.bottle = null
    wake()
  }

  function tapAt(x: number, y: number) {
    ndc.set((x / viewW) * 2 - 1, -(y / viewH) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    let best: { index: number; distance: number; notch: number; x: number; z: number } | null = null
    for (let index = 0; index < bottles.length; index++) {
      const hit = bottles[index].hit()
      if (hit && (!best || hit.distance < best.distance)) best = { index, ...hit }
    }
    if (!best) return
    const { index, notch, x: hx, z: hz } = best
    bottles[index].ripple(hx, hz, -1.6)
    wake()
    if (notch >= 0) options.onTap(index, notch)
  }

  const onUp = (e: PointerEvent) => endPointer(e, false)
  const onCancel = (e: PointerEvent) => endPointer(e, true)
  function onContextLost(e: Event) {
    e.preventDefault()
    cancelAnimationFrame(frame)
    frame = 0
    options.onContextLost()
  }
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onCancel)
  canvas.addEventListener('webglcontextlost', onContextLost)

  function setReducedMotion(next: boolean) {
    reduced = next
    unwatchTilt()
    unwatchTilt = reduced ? () => {} : watchTilt(wake)
    wake()
  }
  setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  refreshTheme()

  return {
    setBottles(input) {
      if (input.length !== bottles.length || input.some((b, i) => b.notches.length !== bottles[i].notches)) build(input)
      else input.forEach((b, i) => bottles[i].setNotches(b.notches))
      wake()
    },
    setFont(family) {
      font = family
      for (const b of bottles) b.drawLabels()
      render()
    },
    refreshTheme,
    setReducedMotion,
    setVisible(next) {
      visible = next
      if (!visible) {
        cancelAnimationFrame(frame)
        frame = 0
        last = 0
      } else wake()
    },
    resize: layout,
    dispose() {
      disposed = true
      cancelAnimationFrame(frame)
      unwatchTilt()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      for (const b of bottles) b.dispose()
      bottles = []
      renderer.dispose()
      // Sul telefono la memoria della GPU torna subito, senza aspettare il garbage collector.
      renderer.forceContextLoss()
    },
  }
}
