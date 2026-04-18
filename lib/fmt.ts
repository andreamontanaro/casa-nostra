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

export const SPLIT_LABELS: Record<string, string> = {
  fifty_fifty: '50 / 50',
  sixty_forty: '60 / 40',
  custom: 'Personalizzato',
}
