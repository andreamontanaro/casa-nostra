// Palette "arcade" del modulo Casa: colori pieni per area, usati per le
// icon-tile e gli accenti di gioco. Distinta da CHORE_AREA_CONTAINER (tinte
// tenui usate storicamente altrove) e da CATEGORY_VISUAL delle spese — i due
// moduli non condividono palette per design (lib/fmt.ts).
export interface ChoreAreaTheme {
  from: string
  to: string
  solid: string
}

export const CHORE_AREA_THEME: Record<string, ChoreAreaTheme> = {
  cucina: { from: '#ffa25c', to: '#ea6a2e', solid: '#ee7431' },
  bagno: { from: '#63b0ff', to: '#2a78d6', solid: '#3383dd' },
  pulizie: { from: '#4fe0ac', to: '#149766', solid: '#17a271' },
  spazzatura: { from: '#a8afb8', to: '#767c84', solid: '#7d838b' },
  bucato: { from: '#b79dfd', to: '#7c3aed', solid: '#8347ef' },
  spesa: { from: '#ffd76b', to: '#e29400', solid: '#e89b00' },
  manutenzione: { from: '#ffa0c6', to: '#e8659a', solid: '#ea6ca0' },
  altro: { from: '#9aa6ff', to: '#6d7cff', solid: '#7683ff' },
}

function themeFor(area: string): ChoreAreaTheme {
  return CHORE_AREA_THEME[area] ?? CHORE_AREA_THEME.altro
}

/** Gradiente diagonale pieno, per le icon-tile delle faccende. */
export function choreAreaGradient(area: string): string {
  const t = themeFor(area)
  return `linear-gradient(135deg, ${t.from}, ${t.to})`
}

/** Tinta piena, per bordi/accenti puntuali che non reggono un gradiente. */
export function choreAreaSolid(area: string): string {
  return themeFor(area).solid
}
