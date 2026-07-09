'use client'

import { motion } from 'motion/react'
import { Check, ArrowRight } from 'lucide-react'
import { formatEur } from '@/lib/fmt'
import { cn } from '@/lib/utils'
import { Tables } from '@/types/database'

type BalanceRow = Tables<'v_user_open_balance'>

interface BalanceCardProps {
  rows: BalanceRow[]
  currentUserId: string
}

function initialsOf(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function Avatar({
  name,
  highlighted,
  className,
}: {
  name: string | null
  highlighted?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold',
        highlighted
          ? 'border-accent/30 bg-accent text-accent-foreground'
          : 'border-border bg-surface/70 text-muted',
        className,
      )}
    >
      {initialsOf(name)}
    </div>
  )
}

export function BalanceCard({ rows, currentUserId }: BalanceCardProps) {
  const me = rows.find((r) => r.user_id === currentUserId)
  const other = rows.find((r) => r.user_id !== currentUserId)

  // Manca uno dei due profili (es. secondo utente non ancora configurato):
  // mostra uno stato neutro invece di far sparire la card senza spiegazione.
  if (!me || !other) {
    return (
      <div className="relative px-1 py-2 text-foreground">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          Saldo corrente
        </p>
        <p className="mt-2 text-2xl font-bold tracking-tight">Non disponibile</p>
        <p className="mt-1 text-sm text-muted">
          Il saldo comparirà quando entrambi i profili saranno configurati.
        </p>
      </div>
    )
  }

  const netMe = me.net_position ?? 0
  const absAmount = Math.abs(netMe)
  const isCredit = netMe > 0
  const isZero = netMe === 0

  const payer = isCredit ? other : me
  const receiver = isCredit ? me : other

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      className="relative px-1 py-2 text-foreground"
    >
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          Saldo corrente
        </p>

        {isZero ? (
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-muted text-accent-soft">
              <Check className="size-5" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">Siete pari</p>
              <p className="text-sm opacity-90">Niente da conguagliare</p>
            </div>
          </div>
        ) : (
          <>
            <motion.p
              key={absAmount}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="mt-2 text-4xl font-bold tracking-tight tabular-nums"
            >
              {formatEur(absAmount)}
            </motion.p>

            <div className="mt-3 flex items-center gap-3">
              <Avatar
                name={payer.display_name}
                highlighted={!isCredit}
                className="ring-1 ring-accent-foreground/10"
              />
              <motion.div
                initial={{ x: -6, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-muted text-accent-soft"
              >
                <ArrowRight className="size-3.5" strokeWidth={2.5} />
              </motion.div>
              <Avatar
                name={receiver.display_name}
                highlighted={isCredit}
                className="ring-1 ring-accent-foreground/10"
              />
              <p className="ml-1 text-sm leading-tight text-muted">
                {isCredit ? (
                  <>
                    <span className="font-medium text-foreground">
                      {payer.display_name}
                    </span>
                    <br />
                    ti deve questi soldi
                  </>
                ) : (
                  <>
                    Devi a{' '}
                    <span className="font-medium text-foreground">
                      {receiver.display_name}
                    </span>
                  </>
                )}
              </p>
            </div>
          </>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs">
          <div>
            <p className="text-muted">Hai anticipato</p>
            <p className="mt-0.5 font-semibold tabular-nums">
              {formatEur(me.total_anticipated ?? 0)}
            </p>
          </div>
          <div className="border-x border-border px-3">
            <p className="text-muted">Quota personale</p>
            <p className="mt-0.5 font-semibold tabular-nums">
              {formatEur(me.total_owed ?? 0)}
            </p>
          </div>
          <div>
            <p className="truncate text-muted">
              {other.display_name?.split(' ')[0]} ha messo
            </p>
            <p className="mt-0.5 font-semibold tabular-nums">
              {formatEur(other.total_anticipated ?? 0)}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
