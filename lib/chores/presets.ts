/**
 * Gli ambiti in cui stanno le azioni delle faccende. Le azioni non sono
 * predefinite: le create voi man mano (tabella `chore_presets`), e qui c'è
 * solo dove metterle. Servono a trovarle più in fretta: l'ambito non pesa
 * niente, ogni faccenda riempie una tacca come tutte le altre.
 *
 * Gli id sono anche il vincolo `group_id` di `chore_presets`: aggiungendo un
 * ambito va aggiunto lì, e tests/chores.test.mjs controlla che coincidano.
 */

export interface ChorePresetGroup {
  id: string
  label: string
  icon: string
}

export const CHORE_PRESET_GROUPS: ChorePresetGroup[] = [
  { id: 'cucina', label: 'Cucina', icon: '🍳' },
  { id: 'pulizie', label: 'Pulizie', icon: '🧹' },
  { id: 'bagno', label: 'Bagno', icon: '🛁' },
  { id: 'bucato', label: 'Bucato', icon: '🧺' },
  { id: 'rifiuti', label: 'Rifiuti', icon: '🗑️' },
  { id: 'spesa', label: 'Spesa e commissioni', icon: '🛒' },
  { id: 'manutenzione', label: 'Casa e piante', icon: '🪴' },
]

/** Un'azione creata da voi, dalla tabella `chore_presets`. */
export interface CustomChorePreset {
  id: string
  name: string
  groupId: string
}

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .toLowerCase()
    .trim()
}

/**
 * Cerca tra i nomi (le vostre azioni e le faccende già segnate): tutte le
 * parole scritte devono comparire, senza badare ad accenti e maiuscole
 * ("piatti", "lavo pia"). Senza doppioni, nell'ordine ricevuto.
 */
export function searchChoreNames(query: string, names: string[], limit = 12): string[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const seen = new Set<string>()
  const results: string[] = []
  for (const name of names) {
    const key = normalize(name)
    if (seen.has(key)) continue
    seen.add(key)
    if (words.every((w) => key.includes(w))) results.push(name)
    if (results.length >= limit) break
  }
  return results
}

/** La chiave di un nome tra i recenti: la stessa in `chore_recent_dismissals.name_key`. */
export function recentKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * I nomi delle ultime faccende segnate, dal più recente, senza doppioni.
 * Un nome tolto dai recenti resta fuori finché non viene segnato di nuovo
 * dopo averlo tolto: togliere nasconde, non cancella niente.
 */
export function recentChoreNames(
  entries: { name: string; created_at: string }[],
  dismissals: { name_key: string; dismissed_at: string }[],
  limit = 8,
): string[] {
  const dismissedAt = new Map(dismissals.map((d) => [d.name_key, Date.parse(d.dismissed_at)]))
  const latest = new Map<string, { name: string; at: number }>()
  for (const entry of entries) {
    const key = recentKey(entry.name)
    const at = Date.parse(entry.created_at)
    const seen = latest.get(key)
    if (!seen || at > seen.at) latest.set(key, { name: entry.name.trim(), at })
  }
  return [...latest.entries()]
    .filter(([key, { at }]) => !(at <= (dismissedAt.get(key) ?? -Infinity)))
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, limit)
    .map(([, { name }]) => name)
}
