'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Check, ArrowRight, ArrowLeftRight } from 'lucide-react'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import { Avatar } from '@/components/ui/Avatar'
import { buttonVariants } from '@/components/ui/Button'
import { formatEur } from '@/lib/fmt'
import { springSoft } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { Tables } from '@/types/database'

type BalanceRow = Tables<'v_user_open_balance'>

interface BalanceCardProps {
  rows: BalanceRow[]
  currentUserId: string
}

function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] ?? '—'
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-3 py-2.5">
      <p className="truncate text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
        {formatEur(value)}
      </p>
    </div>
  )
}

export function BalanceCard({ rows, currentUserId }: BalanceCardProps) {
  const me = rows.find((r) => r.user_id === currentUserId)
  const other = rows.find((r) => r.user_id !== currentUserId)

  // Manca uno dei due profili (es. secondo utente non ancora configurato):
  // stato neutro invece di far sparire la card senza spiegazione.
  if (!me || !other) {
    return (
      <div className="px-1 pt-1">
        <p className="text-label font-medium uppercase tracking-wider text-muted">
          Saldo corrente
        </p>
        <p className="mt-2 text-display-sm font-bold text-foreground">
          Non disponibile
        </p>
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
      transition={springSoft}
      className="px-1 pt-1"
    >
      <p className="text-label font-medium uppercase tracking-wider text-muted">
        Saldo corrente
      </p>

      {isZero ? (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-positive-muted text-positive-soft">
            <Check className="size-5" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-display-sm font-bold tracking-[-0.02em] text-foreground">
              Siete pari
            </p>
            <p className="text-sm text-muted">Niente da conguagliare</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-1">
            <AmountDisplay
              value={absAmount}
              size="display"
              tone={isCredit ? 'positive' : 'neutral'}
            />
          </div>

          {/* Direzione del bonifico */}
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-4">
            <Avatar name={payer.display_name} highlighted={!isCredit} />
            <ArrowRight className="size-4 shrink-0 text-muted" strokeWidth={2.5} />
            <Avatar name={receiver.display_name} highlighted={isCredit} />
            <p className="pl-1 text-sm leading-tight text-muted">
              {isCredit ? (
                <>
                  <span className="font-semibold text-foreground">
                    {firstName(payer.display_name)}
                  </span>{' '}
                  ti deve
                </>
              ) : (
                <>
                  Devi a{' '}
                  <span className="font-semibold text-foreground">
                    {firstName(receiver.display_name)}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Azione chiave a un tap */}
          <Link
            href="/conguaglio"
            className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'mt-4 w-full')}
          >
            <ArrowLeftRight className="size-5" strokeWidth={2.4} />
            Conguaglia
          </Link>
        </>
      )}

      {/* Stat-tile */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatTile label="Hai anticipato" value={me.total_anticipated ?? 0} />
        <StatTile label="Quota tua" value={me.total_owed ?? 0} />
        <StatTile
          label={`${firstName(other.display_name)} ha messo`}
          value={other.total_anticipated ?? 0}
        />
      </div>
    </motion.div>
  )
}
