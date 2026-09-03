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
  }).format(new Date(dateStr))
}

export function formatDateShort(dateStr: string) {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(dateStr))
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
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
// Validata CVD (protan/deutan) su banda lightness in light e dark.
//  · hex/hexDark → fill dei grafici (Recharts) nei due temi
//  · container   → classi Tailwind per il tondo dietro l'emoji (stessa tinta ~15%)
export interface CategoryVisual {
  hex: string
  hexDark: string
  container: string
}

export const CATEGORY_VISUAL: Record<string, CategoryVisual> = {
  affitto: {
    hex: '#2a78d6',
    hexDark: '#2a78d6',
    container: 'bg-[#2a78d6]/15 dark:bg-[#2a78d6]/20',
  },
  bolletta: {
    hex: '#eda100',
    hexDark: '#c48300',
    container: 'bg-[#eda100]/15 dark:bg-[#c48300]/25',
  },
  spesa_alimentare: {
    hex: '#1baf7a',
    hexDark: '#1baf7a',
    container: 'bg-[#1baf7a]/15 dark:bg-[#1baf7a]/20',
  },
  abbonamento: {
    hex: '#4a3aa7',
    hexDark: '#8b76e8',
    container: 'bg-[#4a3aa7]/15 dark:bg-[#8b76e8]/20',
  },
  manutenzione: {
    hex: '#eb6834',
    hexDark: '#dd5c2a',
    container: 'bg-[#eb6834]/15 dark:bg-[#dd5c2a]/20',
  },
  viaggi: {
    hex: '#e87ba4',
    hexDark: '#d5628f',
    container: 'bg-[#e87ba4]/15 dark:bg-[#d5628f]/20',
  },
  altro: {
    hex: '#71717a',
    hexDark: '#8b8b93',
    container: 'bg-[#71717a]/15 dark:bg-[#8b8b93]/20',
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
// Modulo "Gestione casa" — faccende domestiche
// ------------------------------------------------------------

export const CHORE_AREA_LABELS: Record<string, string> = {
  cucina: 'Cucina',
  bagno: 'Bagno',
  pulizie: 'Pulizie',
  spazzatura: 'Spazzatura',
  bucato: 'Bucato',
  spesa: 'Spesa',
  manutenzione: 'Manutenzione',
  altro: 'Altro',
}

export const CHORE_AREA_ICON: Record<string, string> = {
  cucina: '🍳',
  bagno: '🛁',
  pulizie: '🧹',
  spazzatura: '🗑️',
  bucato: '🧺',
  spesa: '🛒',
  manutenzione: '🔧',
  altro: '✨',
}

/**
 * Testo neutro sull'ultimo completamento di una faccenda. Non usa mai parole
 * come "in ritardo" o "scaduta" (principio 7 del modulo): l'ordinamento della
 * lista comunica l'urgenza, il testo si limita a dire quando è successo.
 */
export function formatChoreRecency(daysSince: number | null): string {
  if (daysSince === null) return 'Mai fatta'
  if (daysSince <= 0) return 'Fatta oggi'
  if (daysSince === 1) return 'Fatta ieri'
  return `Fatta ${daysSince} giorni fa`
}

/** Etichetta della cadenza di una faccenda ricorrente, o "Gesto" se libera. */
export function formatChoreCadence(days: number | null): string {
  if (days === null) return 'Gesto — nessuna cadenza attesa'
  if (days === 1) return 'Ogni giorno'
  return `Ogni ${days} giorni`
}

/** Chiave 'YYYY-MM-DD' di un timestamp nel fuso di casa (Europe/Rome). */
export function romeDateKey(iso: string): string {
  // 'sv-SE' è un trucco comune per ottenere il formato ISO YYYY-MM-DD da
  // toLocaleDateString senza librerie di date aggiuntive.
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
}

/** Etichetta di un giorno per gli header del feed: "Oggi", "Ieri", o la data estesa. */
export function formatChoreDayLabel(dateKey: string): string {
  const today = romeDateKey(new Date().toISOString())
  const yesterday = romeDateKey(new Date(Date.now() - 86400000).toISOString())
  if (dateKey === today) return 'Oggi'
  if (dateKey === yesterday) return 'Ieri'
  return formatDate(dateKey)
}

/** Saluto contestuale all'ora del giorno, per l'header di benvenuto del modulo faccende. */
export function greetingForHour(hour: number): string {
  if (hour < 6) return 'Buonanotte'
  if (hour < 12) return 'Buongiorno'
  if (hour < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}
