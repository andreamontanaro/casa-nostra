'use client'

import { useGamificationEnabled, setGamificationEnabled } from '@/lib/chores/gamification'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

/**
 * Interruttore "gamification" del modulo Gestione casa (principio 8 del
 * design): con la gamification spenta restano solo le liste di faccende
 * condivise, senza obiettivo, striscia, barra di equilibrio o kudos.
 * Preferenza per-dispositivo (come il tema), non sincronizzata fra i due.
 */
export function GamificationToggle() {
  const enabled = useGamificationEnabled()

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        groupId="gamification"
        value={enabled ? 'on' : 'off'}
        onChange={(v) => setGamificationEnabled(v === 'on')}
        options={[
          { value: 'on', label: 'Attiva' },
          { value: 'off', label: 'Disattiva' },
        ]}
      />
      <p className="text-xs text-muted">
        Nasconde obiettivo settimanale, striscia, barra di equilibrio e kudos in
        &quot;Casa&quot;. Le liste delle faccende restano invariate.
      </p>
    </div>
  )
}
