'use client'

import { useEffect } from 'react'

/**
 * Tiene aggiornata la variabile CSS `--keyboard-inset` con l'altezza della
 * tastiera software, e marca `<html data-keyboard="open">` finché è aperta.
 *
 * Perché serve: su iOS la tastiera non rimpicciolisce il layout viewport, quindi
 * un elemento `position: fixed; bottom: 0` (le nostre sheet, il pannello
 * dell'assistente, le barre azioni sticky) finisce sotto la tastiera insieme al
 * campo che si sta compilando. L'unica misura affidabile è `visualViewport`:
 * la porzione di finestra coperta è `innerHeight - viewport.height - offsetTop`
 * (l'`offsetTop` tiene conto dello scroll che iOS applica da solo per portare
 * il campo a fuoco sopra la tastiera).
 *
 * Su Android il meta viewport `interactive-widget=resizes-content` (vedi
 * `app/layout.tsx`) fa già rimpicciolire il layout viewport: lì l'inset
 * calcolato resta ~0 e non si somma nulla.
 *
 * Chi vuole stare sopra la tastiera usa `bottom: var(--keyboard-inset)` e, per
 * la spaziatura di fondo, `var(--safe-bottom)` al posto di
 * `env(safe-area-inset-bottom)`: con la tastiera aperta la home indicator è
 * coperta e quello spazio è sprecato.
 */
export function KeyboardInsets() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const root = document.documentElement
    let frame = 0
    let current = 0

    // Sotto questa soglia è la barra degli indirizzi che si ritrae o un
    // arrotondamento, non una tastiera: ignorarla evita sfarfallii.
    const MIN_KEYBOARD = 120

    const measure = () => {
      frame = 0
      const raw = window.innerHeight - viewport.height - viewport.offsetTop
      const inset = raw > MIN_KEYBOARD ? Math.round(raw) : 0
      if (inset === current) return

      const opening = current === 0 && inset > 0
      current = inset
      root.style.setProperty('--keyboard-inset', `${inset}px`)
      if (inset > 0) root.setAttribute('data-keyboard', 'open')
      else root.removeAttribute('data-keyboard')

      // Alla comparsa della tastiera il contenitore si è appena accorciato:
      // riportiamo il campo a fuoco al centro dello spazio rimasto.
      if (opening) revealFocused()
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    // Cambio di campo a tastiera già aperta: il browser non sa che la sheet si
    // è accorciata, quindi lo scroll lo facciamo noi.
    const onFocusIn = () => {
      if (current > 0) revealFocused()
    }

    viewport.addEventListener('resize', schedule)
    viewport.addEventListener('scroll', schedule)
    window.addEventListener('orientationchange', schedule)
    document.addEventListener('focusin', onFocusIn)

    schedule()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', schedule)
      viewport.removeEventListener('scroll', schedule)
      window.removeEventListener('orientationchange', schedule)
      document.removeEventListener('focusin', onFocusIn)
      root.style.removeProperty('--keyboard-inset')
      root.removeAttribute('data-keyboard')
    }
  }, [])

  return null
}

/** Porta il campo a fuoco al centro del suo contenitore scrollabile. */
function revealFocused() {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return
  if (!el.matches('input, textarea, select, [contenteditable="true"]')) return

  // Un frame di attesa: prima che il layout recepisca la nuova altezza,
  // scrollIntoView misurerebbe posizioni ormai vecchie.
  requestAnimationFrame(() => {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}
