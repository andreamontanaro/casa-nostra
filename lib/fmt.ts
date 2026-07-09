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

export const CATEGORY_COLOR: Record<string, string> = {
  affitto: 'bg-blue-100 dark:bg-blue-400/15',
  bolletta: 'bg-yellow-100 dark:bg-yellow-400/15',
  spesa_alimentare: 'bg-green-100 dark:bg-green-400/15',
  abbonamento: 'bg-purple-100 dark:bg-purple-400/15',
  manutenzione: 'bg-orange-100 dark:bg-orange-400/15',
  viaggi: 'bg-sky-100 dark:bg-sky-400/15',
  altro: 'bg-zinc-100 dark:bg-zinc-400/15',
}

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

// ---- Modulo "Le mie auto" ----

export const FUEL_LABELS: Record<string, string> = {
  benzina: 'Benzina',
  diesel: 'Diesel',
  gpl: 'GPL',
  metano: 'Metano',
  elettrico: 'Elettrico',
  ibrido: 'Ibrido',
}

export const FUEL_ICON: Record<string, string> = {
  benzina: '⛽',
  diesel: '⛽',
  gpl: '🟢',
  metano: '🔵',
  elettrico: '🔌',
  ibrido: '♻️',
}

export function formatLiters(liters: number) {
  return `${new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(liters)} L`
}

export function formatKm(km: number) {
  return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(km)} km`
}

export function formatPricePerLiter(price: number) {
  return `${new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(price)}/L`
}

export function formatConsumption(lPer100km: number) {
  return `${new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(lPer100km)} L/100km`
}
