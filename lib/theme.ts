/**
 * Costanti colore in formato letterale.
 * Da usare SOLO nei punti dove serve un hex JS e non è possibile leggere le
 * CSS custom properties: metadata/viewport di Next, status bar PWA, ecc.
 * Per lo styling nei componenti usa sempre i token Tailwind (bg-accent, ...).
 */

/** themeColor status bar — light (== --background light). */
export const THEME_COLOR_LIGHT = '#f6f8f7'

/** themeColor status bar — dark (== --dk-background). */
export const THEME_COLOR_DARK = '#0b100f'
