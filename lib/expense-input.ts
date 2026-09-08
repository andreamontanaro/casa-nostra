/** Validazione UX condivisa; vincoli e autorizzazione restano sul database. */
export function parseEuroInput(raw: string): number | null {
  let value = raw.trim().replace(/^€\s*|\s*€$/g, '').replace(/\s/g, '')
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(value)) value = value.replaceAll('.', '')
  if (!/^\d+(?:[.,]\d{0,2})?$/.test(value)) return null
  const amount = Number(value.replace(',', '.'))
  return Number.isFinite(amount) && amount > 0 && amount <= 99999999.99 ? amount : null
}

export interface SplitProfile { id: string; higher_income: boolean; display_name: string }
/** Anteprima nel form, non usata per il saldo o la registrazione del conguaglio. */
export function previewExpenseShares(amount: number, rule: string, paidBy: string, custom: number | null, profiles: readonly SplitProfile[]) {
  return profiles.map((profile) => ({
    ...profile,
    share: rule === 'custom'
      ? (profile.id === paidBy ? Math.round((amount - (custom ?? 0)) * 100) / 100 : custom ?? 0)
      : Math.round(amount * (rule === 'fifty_fifty' ? .5 : profile.higher_income ? .6 : .4) * 100) / 100,
  }))
}
