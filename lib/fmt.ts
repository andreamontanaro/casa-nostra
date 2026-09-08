import { Constants } from '@/types/database'

export function formatEur(amount: number) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  }).format(new Date(dateStr))
}

export function formatDateShort(dateStr: string) {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Rome',
  }).format(new Date(dateStr))
}

/** Chiave YYYY-MM-DD nel fuso orario della casa. */
export function romeDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
}

export function todayISO() {
  return romeDateKey(new Date().toISOString())
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export const CATEGORY_LABELS: Record<string, string> = {
  affitto: 'Affitto',
  bolletta: 'Bolletta',
  spesa_alimentare: 'Spesa',
  abbonamento: 'Abbonamento',
  manutenzione: 'Manutenzione',
  viaggi: 'Viaggi',
  altro: 'Altro',
}

export const CATEGORY_ICON: Record<string, string> = {
  affitto: '🏠',
  bolletta: '⚡',
  spesa_alimentare: '🛒',
  abbonamento: '📺',
  manutenzione: '🔧',
  viaggi: '✈️',
  altro: '📦',
}

// Palette categorica — UNICA fonte di verità (icone categoria + grafici).
// Le categorie hanno anche icona e nome: il colore non è l’unico indicatore.
//  · hex/hexDark → fill dei grafici (Recharts) nei due temi
//  · container   → classi Tailwind per il tondo dietro l'emoji (stessa tinta ~15%)
export interface CategoryVisual {
  hex: string
  hexDark: string
  container: string
}

export const CATEGORY_VISUAL: Record<string, CategoryVisual> = {
  affitto: {
    hex: '#527a9c',
    hexDark: '#a2bfd8',
    container: 'bg-[#527a9c]/15 dark:bg-[#527a9c]/20',
  },
  bolletta: {
    hex: '#a67c22',
    hexDark: '#ddba64',
    container: 'bg-[#a67c22]/15 dark:bg-[#ddba64]/25',
  },
  spesa_alimentare: {
    hex: '#45836a',
    hexDark: '#9bcab3',
    container: 'bg-[#45836a]/15 dark:bg-[#45836a]/20',
  },
  abbonamento: {
    hex: '#876493',
    hexDark: '#c3a3d0',
    container: 'bg-[#876493]/15 dark:bg-[#c3a3d0]/20',
  },
  manutenzione: {
    hex: '#b56b4f',
    hexDark: '#e8ac8a',
    container: 'bg-[#b56b4f]/15 dark:bg-[#e8ac8a]/20',
  },
  viaggi: {
    hex: '#a6627f',
    hexDark: '#deabc1',
    container: 'bg-[#a6627f]/15 dark:bg-[#deabc1]/20',
  },
  altro: {
    hex: '#777f73',
    hexDark: '#bec4b3',
    container: 'bg-[#777f73]/15 dark:bg-[#bec4b3]/20',
  },
}

// Hex "altro" di fallback (grigio "Other", convenzione dataviz).
export const CATEGORY_FALLBACK_HEX = CATEGORY_VISUAL.altro.hex
export const CATEGORY_FALLBACK_HEX_DARK = CATEGORY_VISUAL.altro.hexDark

/** Restituisce il fill del grafico per una categoria nel tema corrente. */
export function categoryHex(category: string, isDark = false): string {
  const v = CATEGORY_VISUAL[category]
  if (!v) return isDark ? CATEGORY_FALLBACK_HEX_DARK : CATEGORY_FALLBACK_HEX
  return isDark ? v.hexDark : v.hex
}

// Alias storico: classi container per il tondo icona (usato da ExpenseRow/CategoryIcon).
export const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_VISUAL).map(([k, v]) => [k, v.container]),
)

export const SPLIT_LABELS: Record<string, string> = {
  fifty_fifty: '50 / 50',
  sixty_forty: '60 / 40',
  custom: 'Personalizzato',
}

type Category = (typeof Constants.public.Enums.expense_category)[number]
type SplitRule = (typeof Constants.public.Enums.split_rule)[number]

// Regola di divisione proposta di default in base alla categoria.
// Affitto e viaggi 50/50, tutto il resto 60/40 (sempre modificabile dall'utente).
export const DEFAULT_SPLIT: Record<Category, SplitRule> = {
  affitto: 'fifty_fifty',
  bolletta: 'sixty_forty',
  spesa_alimentare: 'sixty_forty',
  abbonamento: 'sixty_forty',
  manutenzione: 'sixty_forty',
  viaggi: 'fifty_fifty',
  altro: 'sixty_forty',
}



// ------------------------------------------------------------
// Modulo "Lista della spesa"
// ------------------------------------------------------------

export const SHOPPING_CATEGORY_LABELS: Record<string, string> = {
  cibo: 'Cibo',
  bevande: 'Bevande',
  cura_casa: 'Cura della casa',
  igiene_persona: 'Igiene personale',
  farmacia: 'Farmacia',
  casalinghi: 'Casalinghi',
  altro: 'Altro',
}

export const SHOPPING_CATEGORY_ICON: Record<string, string> = {
  cibo: '🍎',
  bevande: '🥤',
  cura_casa: '🧽',
  igiene_persona: '🧴',
  farmacia: '💊',
  casalinghi: '🔌',
  altro: '📦',
}

export const SHOPPING_URGENCY_LABELS: Record<string, string> = {
  bassa: 'Quando capita',
  media: 'Normale',
  alta: 'Urgente',
}

/** Etichetta corta dell'urgenza, per i badge di riga dove lo spazio è poco. */
export const SHOPPING_URGENCY_SHORT: Record<string, string> = {
  bassa: 'Con calma',
  media: 'Normale',
  alta: 'Urgente',
}

// Solo l'urgenza alta ha un colore: se tutto è evidenziato, niente lo è.
export const SHOPPING_URGENCY_CLASS: Record<string, string> = {
  bassa: 'bg-surface-sunken text-muted',
  media: 'bg-surface-sunken text-muted',
  alta: 'bg-destructive/12 text-destructive dark:bg-destructive/20',
}

/** Ordine di visualizzazione delle categorie nella lista raggruppata. */
export const SHOPPING_CATEGORY_ORDER = [
  'cibo',
  'bevande',
  'cura_casa',
  'igiene_persona',
  'farmacia',
  'casalinghi',
  'altro',
] as const

/** «Comprato oggi», «ieri», o la data breve: sottotitolo dello storico. */
export function formatBoughtWhen(iso: string | null): string {
  if (!iso) return ''
  const key = romeDateKey(iso)
  const today = romeDateKey(new Date().toISOString())
  const yesterday = romeDateKey(new Date(Date.now() - 86400000).toISOString())
  if (key === today) return 'oggi'
  if (key === yesterday) return 'ieri'
  return formatDateShort(iso)
}
