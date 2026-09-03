'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { Card } from '@/components/ui/Card'
import { ListRow } from '@/components/ui/ListRow'
import { Badge } from '@/components/ui/Badge'
import { ChoreIcon } from '@/components/ChoreIcon'
import { TemplateFormSheet } from './TemplateFormSheet'
import { CHORE_AREA_LABELS, formatChoreCadence } from '@/lib/fmt'
import { springSnappy } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { ChoreTemplate } from '@/lib/queries'

interface CatalogoClientProps {
  templates: ChoreTemplate[]
}

export function CatalogoClient({ templates }: CatalogoClientProps) {
  const [editing, setEditing] = useState<ChoreTemplate | null>(null)
  const [creating, setCreating] = useState(false)

  const active = templates.filter((t) => t.active)
  const inactive = templates.filter((t) => !t.active)

  const groups = Object.entries(
    active.reduce<Record<string, ChoreTemplate[]>>((acc, t) => {
      ;(acc[t.area] ??= []).push(t)
      return acc
    }, {}),
  )

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-24">
      <p className="px-1 text-sm text-muted">
        Il catalogo è di entrambi: qualsiasi modifica vale per tutti e due.
      </p>

      {groups.map(([area, items]) => (
        <section key={area}>
          <h2 className="mb-3 px-1 text-label font-semibold uppercase tracking-wide text-muted">
            {CHORE_AREA_LABELS[area] ?? area}
          </h2>
          <Card className="divide-y divide-border overflow-hidden p-0">
            {items.map((t) => (
              <ListRow
                key={t.id}
                leading={<ChoreIcon area={t.area} size="sm" />}
                title={t.name}
                subtitle={`${formatChoreCadence(t.cadence_days)} · ${t.effort_xp} XP`}
                onClick={() => setEditing(t)}
              />
            ))}
          </Card>
        </section>
      ))}

      {inactive.length > 0 && (
        <section>
          <h2 className="mb-3 px-1 text-label font-semibold uppercase tracking-wide text-muted">
            Disattivate
          </h2>
          <Card className="divide-y divide-border overflow-hidden p-0">
            {inactive.map((t) => (
              <ListRow
                key={t.id}
                leading={<ChoreIcon area={t.area} size="sm" className="opacity-50" />}
                title={<span className="text-muted">{t.name}</span>}
                subtitle={formatChoreCadence(t.cadence_days)}
                onClick={() => setEditing(t)}
                trailing={<Badge variant="muted">disattivata</Badge>}
              />
            ))}
          </Card>
        </section>
      )}

      <motion.button
        type="button"
        onClick={() => setCreating(true)}
        aria-label="Nuova faccenda nel catalogo"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...springSnappy, delay: 0.1 }}
        whileTap={{ scale: 0.92 }}
        className={cn(
          'fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30',
          'flex size-14 items-center justify-center rounded-full',
          'bg-accent text-accent-foreground shadow-fab',
        )}
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </motion.button>

      {/* key: rimonta il form quando cambia la voce da modificare (niente
          useEffect di sincronizzazione nel form, vedi TemplateFormSheet). */}
      <TemplateFormSheet
        key={editing?.id ?? 'edit-empty'}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        template={editing}
      />
      <TemplateFormSheet key={creating ? 'create-open' : 'create-closed'} open={creating} onOpenChange={setCreating} />
    </div>
  )
}
