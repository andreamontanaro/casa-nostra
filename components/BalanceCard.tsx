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
          ? 'border-accent-foreground/40 bg-accent-foreground/25'
          : 'border-accent-foreground/20 bg-accent-foreground/10 opacity-80',
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

  if (!me || !other) return null

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
      className={cn(
        'relative overflow-hidden rounded-3xl p-5 shadow-card',
        'text-accent-foreground',
        'bg-gradient-to-br from-accent via-accent to-accent-soft',
      )}
    >
      {/* Highlight interno */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-accent-foreground/10 via-transparent to-transparent" />
      {/* Blob decorativo */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent-foreground/10 blur-2xl" />

      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wider opacity-80">
          Saldo corrente
        </p>

        {isZero ? (
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-foreground/20">
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
                className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-foreground/15"
              >
                <ArrowRight className="size-3.5" strokeWidth={2.5} />
              </motion.div>
              <Avatar
                name={receiver.display_name}
                highlighted={isCredit}
                className="ring-1 ring-accent-foreground/10"
              />
              <p className="ml-1 text-sm leading-tight opacity-90">
                {isCredit ? (
                  <>
                    <span className="font-medium">{payer.display_name}</span>
                    <br />
                    ti deve questi soldi
                  </>
                ) : (
                  <>
                    Devi a{' '}
                    <span className="font-medium">{receiver.display_name}</span>
                  </>
                )}
              </p>
            </div>
          </>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-accent-foreground/20 pt-3 text-xs">
          <div>
            <p className="opacity-70">Hai anticipato</p>
            <p className="mt-0.5 font-semibold tabular-nums">
              {formatEur(me.total_anticipated ?? 0)}
            </p>
          </div>
          <div className="border-x border-accent-foreground/15 px-3">
            <p className="opacity-70">Quota personale</p>
            <p className="mt-0.5 font-semibold tabular-nums">
              {formatEur(me.total_owed ?? 0)}
            </p>
          </div>
          <div>
            <p className="truncate opacity-70">
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
