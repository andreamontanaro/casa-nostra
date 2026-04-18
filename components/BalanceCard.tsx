import { formatEur } from '@/lib/fmt'
import { Tables } from '@/types/database'

type BalanceRow = Tables<'v_user_open_balance'>

interface BalanceCardProps {
  rows: BalanceRow[]
  currentUserId: string
}

export function BalanceCard({ rows, currentUserId }: BalanceCardProps) {
  const me = rows.find((r) => r.user_id === currentUserId)
  const other = rows.find((r) => r.user_id !== currentUserId)

  if (!me || !other) return null

  const netMe = me.net_position ?? 0
  const absAmount = Math.abs(netMe)
  const isCredit = netMe > 0
  const isZero = netMe === 0

  return (
    <div className="rounded-2xl bg-accent p-5 text-accent-foreground shadow-sm">
      <p className="text-sm font-medium opacity-80">Saldo corrente</p>

      {isZero ? (
        <p className="mt-2 text-2xl font-bold">Siete pari</p>
      ) : (
        <>
          <p className="mt-2 text-3xl font-bold tracking-tight">
            {formatEur(absAmount)}
          </p>
          <p className="mt-1 text-sm opacity-90">
            {isCredit
              ? <>{other.display_name} ti deve questi soldi</>
              : <>Devi {formatEur(absAmount)} a {other.display_name}</>
            }
          </p>
        </>
      )}

      <div className="mt-4 flex gap-4 border-t border-accent-foreground/20 pt-3 text-xs">
        <div className="flex-1">
          <p className="opacity-70">Hai anticipato</p>
          <p className="mt-0.5 font-semibold">{formatEur(me.total_anticipated ?? 0)}</p>
        </div>
        <div className="flex-1">
          <p className="opacity-70">Quota dovuta</p>
          <p className="mt-0.5 font-semibold">{formatEur(me.total_owed ?? 0)}</p>
        </div>
        <div className="flex-1">
          <p className="opacity-70">{other.display_name} ha anticipato</p>
          <p className="mt-0.5 font-semibold">{formatEur(other.total_anticipated ?? 0)}</p>
        </div>
      </div>
    </div>
  )
}
