import { formatEur } from '@/lib/fmt'

/** Riga della vista v_user_open_balance (il saldo è sempre calcolato sul DB). */
export interface BalanceRow {
  user_id: string | null
  display_name: string | null
  net_position: number | null
  total_anticipated?: number | null
  total_owed?: number | null
}

export interface BalanceSummary {
  /** Chi ha anticipato più del dovuto, se i conti non sono in pari. */
  creditor: BalanceRow | null
  /** Chi deve dei soldi all'altro, se i conti non sono in pari. */
  debtor: BalanceRow | null
  /** Differenza in euro, sempre positiva (0 se in pari). */
  amount: number
  /** Frase pronta all'uso, es. «Giulia deve 120,50 € ad Andrea». */
  text: string
}

// Sotto il mezzo centesimo i conti si considerano in pari: la vista arrotonda a
// due decimali, ma la soglia protegge da residui di arrotondamento.
const EPSILON = 0.005

/**
 * Traduce le righe di `v_user_open_balance` in una frase leggibile.
 * Non ricalcola nulla: si limita a leggere `net_position`.
 */
export function describeBalance(rows: BalanceRow[]): BalanceSummary {
  const creditor = rows.find((r) => (r.net_position ?? 0) > EPSILON) ?? null
  const debtor = rows.find((r) => (r.net_position ?? 0) < -EPSILON) ?? null

  if (!creditor || !debtor) {
    return { creditor: null, debtor: null, amount: 0, text: 'Siete in pari.' }
  }

  const amount = Math.abs(debtor.net_position ?? 0)
  return {
    creditor,
    debtor,
    amount,
    text: `${debtor.display_name} deve ${formatEur(amount)} a ${creditor.display_name}.`,
  }
}
