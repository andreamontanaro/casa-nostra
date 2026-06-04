'use client'

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import {
  buildKmTimeline,
  computeConsumption,
  computeDistanceStats,
  currentKm,
  fuelTotals,
  type Car,
  type DistancePeriod,
  type FuelEntry,
  type OdometerReading,
} from '@/lib/cars'
import {
  formatConsumption,
  formatEur,
  formatKm,
  formatLiters,
} from '@/lib/fmt'
import { cn } from '@/lib/utils'

type CarData = {
  car: Car
  fuelEntries: FuelEntry[]
  odometerReadings: OdometerReading[]
}

const PERIOD_OPTIONS: { value: DistancePeriod; label: string }[] = [
  { value: 'day', label: 'Giorno' },
  { value: 'week', label: 'Settimana' },
  { value: 'month', label: 'Mese' },
]

export function ConsumiClient({ data }: { data: CarData[] }) {
  const [carId, setCarId] = useState(data[0]?.car.id ?? '')
  const [period, setPeriod] = useState<DistancePeriod>('month')

  const selected = useMemo(
    () => data.find((d) => d.car.id === carId) ?? data[0],
    [data, carId],
  )

  const consumption = useMemo(
    () => computeConsumption(selected.fuelEntries),
    [selected],
  )
  const totals = useMemo(() => fuelTotals(selected.fuelEntries), [selected])
  const timeline = useMemo(
    () =>
      buildKmTimeline(selected.car, selected.fuelEntries, selected.odometerReadings),
    [selected],
  )
  const distance = useMemo(
    () => computeDistanceStats(timeline, period),
    [timeline, period],
  )
  const kmNow = useMemo(
    () => currentKm(selected.car, selected.fuelEntries, selected.odometerReadings),
    [selected],
  )

  const consumptionSeries = useMemo(
    () =>
      consumption.segments.map((s) => ({
        label: s.date.slice(8, 10) + '/' + s.date.slice(5, 7),
        value: s.lPer100km,
      })),
    [consumption],
  )

  return (
    <div className="flex flex-col gap-4">
      {data.length > 1 && (
        <SegmentedControl
          groupId="consumi-car"
          value={carId}
          onChange={setCarId}
          options={data.map((d) => ({ value: d.car.id, label: d.car.model }))}
        />
      )}

      {/* --- Consumi --- */}
      <Card>
        <CardHeader>
          <p className="text-sm font-semibold text-foreground">Consumo</p>
        </CardHeader>
        <CardContent>
          {consumption.avgLPer100km == null ? (
            <EmptyState>
              Servono almeno due rifornimenti &quot;a pieno&quot; con i km
              registrati per calcolare il consumo.
            </EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-surface-raised p-3 text-center">
                <Stat
                  label="Medio"
                  value={formatConsumption(consumption.avgLPer100km)}
                />
                <Stat
                  label="km/L"
                  value={
                    consumption.avgKmPerL != null
                      ? consumption.avgKmPerL.toLocaleString('it-IT')
                      : '—'
                  }
                  bordered
                />
                <Stat
                  label="€/km"
                  value={
                    consumption.avgCostPerKm != null
                      ? formatEur(consumption.avgCostPerKm)
                      : '—'
                  }
                />
              </div>

              {consumptionSeries.length >= 2 && (
                <div className="-mx-2 mt-4 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={consumptionSeries}
                      margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'var(--muted)' }}
                        interval="preserveStartEnd"
                      />
                      <Tooltip content={<ConsumptionTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="var(--accent)"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: 'var(--accent)' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <Stat
              label="Totale carburante"
              value={formatLiters(totals.liters)}
              boxed
            />
            <Stat label="Totale speso" value={formatEur(totals.cost)} boxed />
          </div>
        </CardContent>
      </Card>

      {/* --- Percorrenze --- */}
      <Card>
        <CardHeader className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-foreground">Percorrenze</p>
          <p className="text-xs text-muted">Distanza per periodo</p>
        </CardHeader>
        <CardContent>
          <SegmentedControl
            groupId="consumi-period"
            value={period}
            onChange={(v) => setPeriod(v as DistancePeriod)}
            options={PERIOD_OPTIONS}
          />

          <div className="mt-3 grid grid-cols-3 gap-3 rounded-2xl bg-surface-raised p-3 text-center">
            <Stat label="Km attuali" value={formatKm(kmNow)} />
            <Stat
              label="Media/giorno"
              value={distance.totalDays > 0 ? formatKm(distance.avgPerDay) : '—'}
              bordered
            />
            <Stat
              label="Totale"
              value={distance.totalKm > 0 ? formatKm(distance.totalKm) : '—'}
            />
          </div>

          {distance.buckets.length === 0 ? (
            <EmptyState className="mt-4">
              Registra almeno due letture del contachilometri (anche dai
              rifornimenti) per vedere le percorrenze.
            </EmptyState>
          ) : (
            <div className="-mx-2 mt-4 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={distance.buckets}
                  margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                  barCategoryGap="22%"
                >
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted)' }}
                    interval="preserveStartEnd"
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--surface-raised)', opacity: 0.6 }}
                    content={<DistanceTooltip />}
                  />
                  <Bar dataKey="km" radius={[6, 6, 2, 2]}>
                    {distance.buckets.map((b, i) => (
                      <Cell
                        key={b.key}
                        fill={
                          i === distance.buckets.length - 1
                            ? 'var(--accent)'
                            : 'var(--accent-soft)'
                        }
                        fillOpacity={
                          i === distance.buckets.length - 1 ? 1 : 0.55
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({
  label,
  value,
  bordered,
  boxed,
}: {
  label: string
  value: string
  bordered?: boolean
  boxed?: boolean
}) {
  return (
    <div
      className={cn(
        bordered && 'border-x border-border',
        boxed && 'rounded-2xl bg-surface-raised p-3',
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

function EmptyState({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p className={cn('py-6 text-center text-sm text-muted', className)}>
      {children}
    </p>
  )
}

interface TooltipEntry {
  value?: number
  payload?: { label?: string }
}

function ConsumptionTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipEntry[]
}) {
  if (!active || !payload?.length) return null
  const value = Number(payload[0].value ?? 0)
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-foreground">{payload[0].payload?.label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-accent">
        {formatConsumption(value)}
      </p>
    </div>
  )
}

function DistanceTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipEntry[]
}) {
  if (!active || !payload?.length) return null
  const value = Number(payload[0].value ?? 0)
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-foreground">{payload[0].payload?.label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-accent">
        {formatKm(value)}
      </p>
    </div>
  )
}

function SegmentedControl({
  groupId,
  value,
  onChange,
  options,
}: {
  groupId: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="relative flex rounded-2xl border border-border bg-surface-raised p-1">
      {options.map((opt) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex-1 rounded-xl px-3 py-1.5 text-sm font-medium',
              'transition-colors duration-150',
              isActive ? 'text-foreground' : 'text-muted',
            )}
          >
            {isActive && (
              <motion.span
                layoutId={`segctl-${groupId}`}
                transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                className="absolute inset-0 -z-10 rounded-xl bg-surface shadow-soft"
              />
            )}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
