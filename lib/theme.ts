/**
 * Costanti colore in formato letterale.
 * Da usare SOLO nei punti dove serve un hex JS e non è possibile leggere le
 * CSS custom properties: metadata/viewport di Next, status bar PWA, ecc.
 * Per lo styling nei componenti usa sempre i token Tailwind (bg-accent, ...).
 */

/** themeColor status bar — light (== --background light della menta). */
export const THEME_COLOR_LIGHT = '#f8f5ef'

/** themeColor status bar — dark (== --dk-background della menta). */
export const THEME_COLOR_DARK = '#121b19'

/**
 * Accenti tra cui scegliere, in ordine di selettore (giro del cerchio
 * cromatico a partire dalla menta). La palette completa di ognuno — primario,
 * contenitore, testo sul primario, ombra del FAB, sfondo tinto, chiaro e
 * scuro — sta in `app/globals.css`; qui solo nome, i due colori del campione
 * nel selettore (== `--accent` e `--dk-accent` del suo blocco) e i due sfondi
 * per la barra di sistema (== `--background` e `--dk-background`). Che
 * combacino lo verifica un test.
 *
 * La menta è l'accento di base: non mette nessun attributo su `<html>`. Gli
 * altri si applicano con `data-accent="<id>"`, persistito in localStorage.
 */
export const ACCENTS = [
  { id: 'menta', label: 'Menta', light: '#176b5b', dark: '#94d5b8', bgLight: THEME_COLOR_LIGHT, bgDark: THEME_COLOR_DARK },
  { id: 'oceano', label: 'Oceano', light: '#25618f', dark: '#9fc7ec', bgLight: '#f0f6fd', bgDark: '#141a1f' },
  { id: 'lavanda', label: 'Lavanda', light: '#68509a', dark: '#c9b6ef', bgLight: '#f6f4fc', bgDark: '#1a171e' },
  { id: 'lampone', label: 'Lampone', light: '#a3345d', dark: '#f3aec5', bgLight: '#fcf2f5', bgDark: '#1e1619' },
  { id: 'ambra', label: 'Ambra', light: '#8a5a00', dark: '#eec36a', bgLight: '#faf4ed', bgDark: '#1c1812' },
] as const

export type Accent = (typeof ACCENTS)[number]['id']

export const DEFAULT_ACCENT: Accent = 'menta'

/** Chiave localStorage dell'accento scelto (assente = menta). */
export const ACCENT_STORAGE_KEY = 'accent'

export function isAccent(value: unknown): value is Accent {
  return ACCENTS.some((accent) => accent.id === value)
}

/**
 * Porta lo sfondo tinto dell'accento anche nella barra di sistema: riscrive i
 * due `<meta name="theme-color">` (chiaro e scuro, per media query) che Next
 * genera da `viewport.themeColor`. Lo script prima del primo paint in
 * `app/layout.tsx` fa lo stesso con una copia inline di questa logica.
 */
export function syncThemeColor(accent: Accent) {
  const { bgLight, bgDark } = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0]
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = meta.media.includes('dark') ? bgDark : bgLight
  })
}
