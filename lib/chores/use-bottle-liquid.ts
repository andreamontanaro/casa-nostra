'use client'

import { useEffect, useRef } from 'react'
import { readTilt, watchTilt } from './device-tilt'
import {
  createLiquid,
  liquidPaths,
  pokeLiquid,
  resizeLiquid,
  setLiquidTarget,
  settleLiquid,
  stepLiquid,
  streamSegments,
  STREAM_WIDTH,
  type Liquid,
} from './liquid'

/**
 * Anima il liquido di una bottiglia. Il disegno lo fa `ChoreBottle` con degli
 * elementi marcati `data-liquid="…"`; qui li si ritrova una volta, si fa
 * girare la simulazione di `liquid.ts` e a ogni fotogramma si scrivono
 * attributi e `clip-path` direttamente nel DOM, senza passare da React: sono
 * sessanta aggiornamenti al secondo di pochi tracciati.
 *
 * Il ciclo si ferma quando il liquido è fermo e riparte quando cambia il
 * livello, quando il telefono si muove o quando si tocca la bottiglia: a
 * pagina ferma non consuma niente. Con "riduci movimento" il livello cambia di
 * colpo e i sensori non si ascoltano nemmeno.
 *
 * `bonus` e `main` sono le altezze in px dei due strati (tacche × 56). Il
 * ref restituito va sull'elemento che contiene spalla e corpo.
 */
export function useBottleLiquid<T extends HTMLElement>(bonus: number, main: number) {
  const groupRef = useRef<T>(null)
  const targets = useRef({ bonus, main })
  const sim = useRef<{ liquid: Liquid; wake: () => void } | null>(null)

  // Dichiarato prima dell'altro: al montaggio aggiorna i livelli e poi la
  // simulazione nasce già lì, senza versare quello che c'era.
  useEffect(() => {
    targets.current = { bonus, main }
    const current = sim.current
    if (!current) return
    setLiquidTarget(current.liquid, bonus, main)
    current.wake()
  }, [bonus, main])

  useEffect(() => {
    const found = groupRef.current && findParts(groupRef.current)
    if (!found) return
    const parts: Parts = found
    const { body } = parts
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const liquid = createLiquid({
      width: body.clientWidth,
      height: body.clientHeight,
      ...targets.current,
    })
    // Un piccolo assestamento all'arrivo: il liquido si vede che è liquido.
    if (!reduced) liquid.angle = 0.06

    let frame = 0
    let last = 0
    let jolt = readTilt().jolt
    let viewBox = ''

    function paint() {
      const { width: W, height: H } = liquid
      const paths = liquidPaths(liquid)
      const box = `0 0 ${W} ${H}`
      if (box !== viewBox) parts.svg.setAttribute('viewBox', (viewBox = box))
      parts.fill.setAttribute('d', paths.liquid)
      parts.glass.setAttribute('d', paths.main)
      parts.bonus.setAttribute('d', paths.bonus)
      parts.surface.setAttribute('d', paths.surface)
      parts.layer.setAttribute('d', paths.layer)
      parts.faces.dry.style.clipPath = clip(paths.air)
      parts.faces.main.style.clipPath = clip(paths.main)
      parts.faces.bonus.style.clipPath = clip(paths.bonus)

      const stream = streamSegments(liquid)
      const color = stream?.bonus ? 'var(--liquid-layer)' : 'var(--liquid-top)'
      const neckX = 50 - STREAM_WIDTH / 2
      setRect(parts.neckStream, neckX, stream?.neck.y ?? 0, STREAM_WIDTH, stream?.neck.height ?? 0, color)
      // Il corpo è largo quanto la spalla meno il bordo (2 px): stessa larghezza in px.
      const width = (STREAM_WIDTH / 100) * (W + 2)
      setRect(parts.stream, W / 2 - width / 2, stream?.body.y ?? 0, width, stream?.body.height ?? 0, color)

      parts.bubbles.forEach((circle, i) => {
        const bubble = liquid.bubbles[i]
        circle.setAttribute('r', bubble ? String(bubble.r) : '0')
        if (!bubble) return
        circle.setAttribute('cx', bubble.x.toFixed(1))
        circle.setAttribute('cy', bubble.y.toFixed(1))
        circle.style.opacity = String(Math.min(bubble.age * 6, 1))
      })
    }

    function tick(now: number) {
      frame = 0
      const elapsed = last ? (now - last) / 1000 : 1 / 60
      last = now
      const tilt = readTilt()
      const moving = stepLiquid(liquid, elapsed, { tilt: tilt.tilt, jolt: tilt.jolt - jolt })
      jolt = tilt.jolt
      paint()
      if (moving) frame = requestAnimationFrame(tick)
      else last = 0
    }

    const wake = reduced
      ? () => {
          settleLiquid(liquid)
          paint()
        }
      : () => {
          if (!frame) frame = requestAnimationFrame(tick)
        }
    sim.current = { liquid, wake }

    const resize = new ResizeObserver(() => {
      resizeLiquid(liquid, body.clientWidth, body.clientHeight)
      paint()
      wake()
    })
    resize.observe(body)

    // Toccare la bottiglia fa partire un'onda da dove si è toccato.
    function poke(event: PointerEvent) {
      if (reduced) return
      pokeLiquid(liquid, event.clientX - body.getBoundingClientRect().left - body.clientLeft)
      wake()
    }
    body.addEventListener('pointerdown', poke)
    const unwatch = reduced ? () => {} : watchTilt(wake)

    paint()
    wake()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      body.removeEventListener('pointerdown', poke)
      unwatch()
      sim.current = null
    }
  }, [])

  return groupRef
}

interface Parts {
  body: HTMLElement
  svg: SVGSVGElement
  fill: SVGPathElement
  glass: SVGPathElement
  bonus: SVGPathElement
  surface: SVGPathElement
  layer: SVGPathElement
  stream: SVGRectElement
  neckStream: SVGRectElement
  bubbles: SVGCircleElement[]
  faces: { dry: HTMLElement; main: HTMLElement; bonus: HTMLElement }
}

function findParts(group: HTMLElement): Parts | null {
  const one = <T extends Element>(name: string) => group.querySelector<T>(`[data-liquid="${name}"]`)
  const body = one<HTMLElement>('body')
  const svg = one<SVGSVGElement>('svg')
  const fill = one<SVGPathElement>('fill')
  const glass = one<SVGPathElement>('glass')
  const bonus = one<SVGPathElement>('bonus')
  const surface = one<SVGPathElement>('surface')
  const layer = one<SVGPathElement>('layer')
  const stream = one<SVGRectElement>('stream')
  const neckStream = one<SVGRectElement>('neck-stream')
  const dry = one<HTMLElement>('face-dry')
  const main = one<HTMLElement>('face-main')
  const bonusFace = one<HTMLElement>('face-bonus')
  if (!body || !svg || !fill || !glass || !bonus || !surface || !layer || !stream || !neckStream) return null
  if (!dry || !main || !bonusFace) return null
  const bubbles = [...group.querySelectorAll<SVGCircleElement>('[data-liquid="bubble"]')]
  return { body, svg, fill, glass, bonus, surface, layer, stream, neckStream, bubbles, faces: { dry, main, bonus: bonusFace } }
}

/** Un tracciato vuoto ritaglia via tutto: serve un punto, non una stringa vuota. */
function clip(path: string): string {
  return `path('${path || 'M0 0'}')`
}

function setRect(rect: SVGRectElement, x: number, y: number, width: number, height: number, fill: string) {
  rect.setAttribute('x', x.toFixed(2))
  rect.setAttribute('y', y.toFixed(1))
  rect.setAttribute('width', width.toFixed(2))
  rect.setAttribute('height', Math.max(height, 0).toFixed(1))
  rect.style.fill = fill
}
