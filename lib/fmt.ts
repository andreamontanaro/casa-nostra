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

export const CATEGORY_LABELS: Record<string, string> = {
  affitto: 'Affitto',
  bolletta: 'Bolletta',
  spesa_alimentare: 'Spesa',
  abbonamento: 'Abbonamento',
  manutenzione: 'Manutenzione',
  altro: 'Altro',
}

export const CATEGORY_ICON: Record<string, string> = {
  affitto: '🏠',
  bolletta: '⚡',
  spesa_alimentare: '🛒',
  abbonamento: '📺',
  manutenzione: '🔧',
  altro: '📦',
}

export const CATEGORY_COLOR: Record<string, string> = {
  affitto: 'bg-blue-100 dark:bg-blue-950',
  bolletta: 'bg-yellow-100 dark:bg-yellow-950',
  spesa_alimentare: 'bg-green-100 dark:bg-green-950',
  abbonamento: 'bg-purple-100 dark:bg-purple-950',
  manutenzione: 'bg-orange-100 dark:bg-orange-950',
  altro: 'bg-zinc-100 dark:bg-zinc-800',
}

export const SPLIT_LABELS: Record<string, string> = {
  fifty_fifty: '50 / 50',
  sixty_forty: '60 / 40',
  custom: 'Personalizzato',
}
