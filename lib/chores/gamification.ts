'use client'

import { useSyncExternalStore } from 'react'

/**
 * Interruttore "gamification" del modulo Gestione casa (principio 8 del
 * design): preferenza per-dispositivo, come il tema — non uno stato
 * applicativo condiviso, quindi vive in localStorage e non nel DB.
 * `useSyncExternalStore` evita sia il mismatch di idratazione SSR/client
 * sia il pattern "setState dentro un effect" (vedi ThemeToggle per il
 * precedente storico, qui evitato apposta).
 */

const STORAGE_KEY = 'casa-nostra:chores-gamification'
const CHANGE_EVENT = 'casa-nostra:chores-gamification-change'

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(CHANGE_EVENT, callback)
  }
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

function getServerSnapshot(): boolean {
  return true
}

/** true = mostra obiettivo/striscia/barra di equilibrio/kudos. Default: on. */
export function useGamificationEnabled(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function setGamificationEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT))
}
