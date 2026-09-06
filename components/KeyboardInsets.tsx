'use client'

import { useEffect } from 'react'
import { measureKeyboard, NO_KEYBOARD, type KeyboardMetrics } from '@/lib/keyboard'

/**
 * Pubblica le misure della tastiera software in due variabili CSS su `<html>`
 * — `--keyboard-height` (quanto spazio ruba: da sottrarre alle altezze) e
 * `--keyboard-inset` (dove appoggiare un `fixed`: da dare a `bottom`) — e marca
 * `data-keyboard="open"` finché la tastiera è aperta.
 *
 * Perché serve: su iOS la tastiera non accorcia il layout viewport, quindi un
 * elemento `position: fixed; bottom: 0` (le nostre sheet, il pannello
 * dell'assistente) e un'altezza in `svh` non si accorgono di lei. E quando la
 * pagina non può scorrere — una sheet aperta blocca il body — iOS scopre il
 * campo a fuoco spingendo su *tutta* la finestra: il fondo della sheet finisce
 * al posto giusto da sé, ma la sua testa esce dallo schermo. Le due misure
 * servono proprio a distinguere i due casi: vedi `lib/keyboard.ts`.
 *
 * Su Android non c'è niente da calcolare: il meta viewport
 * `interactive-widget=resizes-content` (vedi `app/layout.tsx`) fa accorciare il
 * layout viewport al browser, e le misure restano a zero.
 */
export function KeyboardInsets() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const root = document.documentElement
    let frame = 0
    let current: KeyboardMetrics = NO_KEYBOARD

    const measure = () => {
      frame = 0
      const next = measureKeyboard(window.innerHeight, viewport.height, viewport.offsetTop)
      if (next.height === current.height && next.inset === current.inset) return

      const opening = current.height === 0 && next.height > 0
      current = next
      root.style.setProperty('--keyboard-height', `${next.height}px`)
      root.style.setProperty('--keyboard-inset', `${next.inset}px`)
      if (next.height > 0) root.setAttribute('data-keyboard', 'open')
      else root.removeAttribute('data-keyboard')

      // Il contenitore si è appena accorciato: riportiamo il campo a fuoco al
      // centro dello spazio rimasto.
      if (opening) revealFocused()
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    // Cambio di campo a tastiera già aperta: il browser non sa che la sheet si
    // è accorciata, quindi lo scroll lo facciamo noi.
    const onFocusIn = () => {
      if (current.height > 0) revealFocused()
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
      root.style.removeProperty('--keyboard-height')
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

  // Un frame di attesa: prima che il layout recepisca le nuove misure,
  // scrollIntoView leggerebbe posizioni ormai vecchie.
  // Scorrimento istantaneo, non `smooth`: mentre la tastiera sale, iOS sta
  // già scorrendo per conto suo e le due animazioni si darebbero fastidio.
  requestAnimationFrame(() => {
    el.scrollIntoView({ block: 'center', behavior: 'auto' })
  })
}
