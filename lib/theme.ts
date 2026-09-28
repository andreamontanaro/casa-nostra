/**
 * Costanti colore in formato letterale.
 * Da usare SOLO nei punti dove serve un hex JS e non è possibile leggere le
 * CSS custom properties: metadata/viewport di Next, status bar PWA, ecc.
 * Per lo styling nei componenti usa sempre i token Tailwind (bg-accent, ...).
 */

/** themeColor status bar — light (== --background light). */
export const THEME_COLOR_LIGHT = '#f8f5ef'

/** themeColor status bar — dark (== --dk-background). */
export const THEME_COLOR_DARK = '#121b19'

/**
 * Accenti tra cui scegliere, in ordine di selettore (giro del cerchio
 * cromatico a partire dalla menta). La palette completa di ognuno — primario,
 * contenitore, testo sul primario, ombra del FAB, chiaro e scuro — sta in
 * `app/globals.css`; qui solo nome e i due colori del campione nel selettore
 * (== `--accent` e `--dk-accent` del suo blocco, lo verifica un test).
 *
 * La menta è l'accento di base: non mette nessun attributo su `<html>`. Gli
 * altri si applicano con `data-accent="<id>"`, persistito in localStorage.
 */
export const ACCENTS = [
  { id: 'menta', label: 'Menta', light: '#176b5b', dark: '#94d5b8' },
  { id: 'oceano', label: 'Oceano', light: '#25618f', dark: '#9fc7ec' },
  { id: 'lavanda', label: 'Lavanda', light: '#68509a', dark: '#c9b6ef' },
  { id: 'lampone', label: 'Lampone', light: '#a3345d', dark: '#f3aec5' },
  { id: 'ambra', label: 'Ambra', light: '#8a5a00', dark: '#eec36a' },
] as const

export type Accent = (typeof ACCENTS)[number]['id']

export const DEFAULT_ACCENT: Accent = 'menta'

/** Chiave localStorage dell'accento scelto (assente = menta). */
export const ACCENT_STORAGE_KEY = 'accent'

export function isAccent(value: unknown): value is Accent {
  return ACCENTS.some((accent) => accent.id === value)
}
