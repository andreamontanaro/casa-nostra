'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Rotate3d } from 'lucide-react'
import type { Notch, NotchEntry, NotchHint } from '@/lib/chores/bottle'
import { framing } from '@/lib/chores/liquid3d'
import { BLEED_PX, createBottleScene, type BottleScene } from '@/lib/chores/bottles3d/scene'

export interface Bottle3D {
  id: string
  name: string
  /** Dal basso, come `bottleNotches`. */
  notches: Notch[]
  /** Tap sulla prima tacca vuota: segna (o suggerisce) una faccenda in questa bottiglia. */
  onAdd: () => void
  /** Etichetta del "+" per chi usa uno screen reader. */
  addLabel?: string
}

interface ChoreBottles3DProps {
  /** Da sinistra a destra. */
  bottles: Bottle3D[]
  onEntryTap: (entry: NotchEntry) => void
  onHintTap: (hint: NotchHint) => void
  /** Il 3D non si riesce a disegnare (niente WebGL, o perso più volte): si torna al 2D. */
  onUnavailable: () => void
}

/** Perdite del contesto con la pagina in vista dopo cui si rinuncia al 3D (in background su iOS sono normali). */
const MAX_VISIBLE_LOSSES = 2

/**
 * Le due bottiglie in 3D, in un solo canvas WebGL. Questo componente (e con
 * lui three.js) si carica solo quando qualcuno sceglie la vista 3D:
 * `FaccendeShell` lo importa con `next/dynamic`, senza SSR.
 *
 * Fa da ponte tra React e la scena (`lib/chores/bottles3d/scene.ts`): crea il
 * canvas, gli passa le tacche, i colori del tema e il font, lo mette in pausa
 * quando esce dallo schermo e lo distrugge quando si torna al 2D, liberando
 * la GPU. Il canvas lo crea qui a mano e non con JSX: una scena nuova (per
 * esempio dopo che iOS ha tolto il contesto WebGL) ha bisogno di un canvas
 * nuovo.
 *
 * I tocchi sulle tacche fanno le stesse cose del 2D. Per tastiera e screen
 * reader le tacche restano bottoni veri, nascosti finché non ci si arriva.
 */
export default function ChoreBottles3D({ bottles, onEntryTap, onHintTap, onUnavailable }: ChoreBottles3DProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const nameRefs = useRef<(HTMLSpanElement | null)[]>([])
  const sceneRef = useRef<BottleScene | null>(null)
  const losses = useRef(0)
  const [generation, setGeneration] = useState(0)

  const maxNotches = Math.max(...bottles.map((b) => b.notches.length), 1)
  const aspect = framing(maxNotches).aspect

  // Le tacche cambiano solo quando cambia quello che c'è scritto: la scena si aggiorna solo allora.
  const notchKey = bottles
    .map((b) => b.notches.map((n) => `${n.bonus ? 1 : 0}:${n.entry?.name ?? ''}:${n.hint?.name ?? ''}`).join(','))
    .join('|')

  const sceneBottles = useEffectEvent(() => bottles.map((b) => ({ notches: b.notches })))

  const handleTap = useEffectEvent((bottleIndex: number, notchIndex: number) => {
    const bottle = bottles[bottleIndex]
    const notch = bottle?.notches[notchIndex]
    if (!notch) return
    if (notch.entry) onEntryTap(notch.entry)
    else if (notch.hint) onHintTap(notch.hint)
    else if (notchIndex === firstEmpty(bottle.notches)) bottle.onAdd()
  })

  const handleUnavailable = useEffectEvent(() => onUnavailable())

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: `-${BLEED_PX}px`,
      width: `calc(100% + ${2 * BLEED_PX}px)`,
      height: '100%',
      display: 'block',
      // In verticale si scorre la pagina; in orizzontale si gira la bottiglia.
      touchAction: 'pan-y',
    })
    stage.prepend(canvas)

    let rebuildOnVisible: (() => void) | null = null
    let scene: BottleScene
    try {
      scene = createBottleScene(canvas, stage, {
        onTap: (bottle, notch) => handleTap(bottle, notch),
        onLayout: (names) => {
          names.forEach((p, i) => {
            const el = nameRefs.current[i]
            if (!el) return
            el.style.left = `${p.x}px`
            el.style.top = `${p.y}px`
            el.dataset.ready = ''
          })
        },
        onContextLost: () => {
          if (document.visibilityState === 'visible' && ++losses.current > MAX_VISIBLE_LOSSES) {
            handleUnavailable()
            return
          }
          // Si ricrea tutto, con un canvas nuovo, appena la pagina torna in vista.
          const rebuild = () => {
            if (document.visibilityState !== 'visible') return
            document.removeEventListener('visibilitychange', rebuild)
            rebuildOnVisible = null
            setGeneration((g) => g + 1)
          }
          rebuildOnVisible = rebuild
          document.addEventListener('visibilitychange', rebuild)
          rebuild()
        },
      })
    } catch {
      canvas.remove()
      handleUnavailable()
      return
    }
    sceneRef.current = scene
    scene.setBottles(sceneBottles())

    // Le scritte usano Manrope: si disegnano col font giusto appena c'è.
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-manrope').trim() || 'sans-serif'
    let alive = true
    const fontReady = document.fonts?.load(`700 31px ${family}`) ?? Promise.resolve()
    fontReady.catch(() => {}).finally(() => alive && scene.setFont(family))

    const theme = new MutationObserver(() => scene.refreshTheme())
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] })
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const onScheme = () => scene.refreshTheme()
    darkQuery.addEventListener('change', onScheme)
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotion = () => scene.setReducedMotion(motionQuery.matches)
    motionQuery.addEventListener('change', onMotion)
    const resize = new ResizeObserver(() => scene.resize())
    resize.observe(stage)
    // Fuori dallo schermo non si disegna niente, nemmeno se il telefono si muove.
    const inView = new IntersectionObserver(([entry]) => scene.setVisible(entry.isIntersecting))
    inView.observe(stage)

    return () => {
      alive = false
      if (rebuildOnVisible) document.removeEventListener('visibilitychange', rebuildOnVisible)
      theme.disconnect()
      darkQuery.removeEventListener('change', onScheme)
      motionQuery.removeEventListener('change', onMotion)
      resize.disconnect()
      inView.disconnect()
      scene.dispose()
      sceneRef.current = null
      canvas.remove()
    }
  }, [generation])

  useEffect(() => {
    sceneRef.current?.setBottles(sceneBottles())
  }, [notchKey])

  const description = bottles
    .map((b) => {
      const filled = b.notches.filter((n) => n.entry).length
      return `${b.name}: ${filled} ${filled === 1 ? 'tacca piena' : 'tacche piene'} su ${b.notches.length}`
    })
    .join('. ')

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={stageRef}
        role="img"
        aria-label={`Bottiglie di oggi. ${description}.`}
        className="relative mx-auto w-full max-w-md cursor-grab select-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] active:cursor-grabbing"
        style={{ aspectRatio: aspect }}
      >
        {bottles.map((b, i) => (
          <span
            key={b.id}
            ref={(el) => {
              nameRefs.current[i] = el
            }}
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 -translate-x-1/2 -translate-y-full whitespace-nowrap font-display text-2xl leading-none font-semibold text-foreground opacity-0 data-ready:opacity-100"
          >
            {b.name}
          </span>
        ))}
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
        <Rotate3d className="size-3.5 shrink-0" aria-hidden />
        Trascina una bottiglia per girarla
      </p>

      {/* Le tacche come bottoni veri: invisibili, compaiono quando ci si arriva da tastiera. */}
      <div className="group grid grid-cols-2 gap-3">
        {bottles.map((b) => (
          <ul
            key={b.id}
            aria-label={`Tacche di ${b.name}`}
            className="sr-only flex-col gap-1.5 group-focus-within:not-sr-only group-focus-within:flex"
          >
            {notchButtons(b, onEntryTap, onHintTap)}
          </ul>
        ))}
      </div>
    </div>
  )
}

function firstEmpty(notches: Notch[]): number {
  return notches.findIndex((n) => !n.entry && !n.hint)
}

/** Dall'alto verso il basso, come si leggono. */
function notchButtons(b: Bottle3D, onEntryTap: (e: NotchEntry) => void, onHintTap: (h: NotchHint) => void) {
  const empty = firstEmpty(b.notches)
  const items: React.ReactNode[] = []
  b.notches.forEach((n, i) => {
    let label: string | null = null
    let onClick: (() => void) | null = null
    if (n.entry) {
      const entry = n.entry
      label = n.bonus ? `Bonus: ${entry.name}` : entry.name
      onClick = () => onEntryTap(entry)
    } else if (n.hint) {
      const hint = n.hint
      label = `Suggerimento: ${hint.name}`
      onClick = () => onHintTap(hint)
    } else if (i === empty) {
      label = b.addLabel ?? `Segna una faccenda di ${b.name}`
      onClick = b.onAdd
    }
    if (!label || !onClick) return
    items.unshift(
      <li key={i}>
        <button
          type="button"
          onClick={onClick}
          className="min-h-11 w-full rounded-2xl border border-border-strong bg-surface px-3 py-2 text-left text-sm text-foreground"
        >
          {label}
        </button>
      </li>,
    )
  })
  return items
}
