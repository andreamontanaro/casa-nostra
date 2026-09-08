'use client'

import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/Button'

export const DRAFT_EVENT = 'casa-nostra:expense-draft'
export function draftKey(userId: string) { return 'casa-nostra:expense-draft:' + userId }
export function saveDraft(userId: string, value: unknown) {
  try { sessionStorage.setItem(draftKey(userId), JSON.stringify(value)); window.dispatchEvent(new Event(DRAFT_EVENT)) } catch {}
}
export function clearDraft(userId: string) {
  try { sessionStorage.removeItem(draftKey(userId)); window.dispatchEvent(new Event(DRAFT_EVENT)) } catch {}
}
function subscribe(callback: () => void) {
  window.addEventListener(DRAFT_EVENT, callback)
  return () => window.removeEventListener(DRAFT_EVENT, callback)
}

export function ExpenseDraftNotice({ userId, onRestore }: { userId: string; onRestore: (draft: unknown) => void }) {
  const raw = useSyncExternalStore(subscribe, () => {
    try { return sessionStorage.getItem(draftKey(userId)) } catch { return null }
  }, () => null)
  if (!raw) return null
  return <div className="mb-5 rounded-2xl bg-accent-muted p-4 text-sm text-accent-soft">
    <p className="font-semibold">Hai una spesa lasciata a metà.</p>
    <p className="mt-1 text-xs">Puoi riprendere i campi salvati. Gli allegati vanno riselezionati.</p>
    <div className="mt-2 flex gap-2"><Button variant="ghost" size="sm" onClick={() => {
      try { onRestore(JSON.parse(raw)) } catch { clearDraft(userId) }
    }}>Riprendi bozza</Button><Button variant="ghost" size="sm" onClick={() => clearDraft(userId)}>Scarta</Button></div>
  </div>
}
