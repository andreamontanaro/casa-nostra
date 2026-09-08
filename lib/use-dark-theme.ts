'use client'

import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  media.addEventListener('change', callback)
  return () => { observer.disconnect(); media.removeEventListener('change', callback) }
}
function snapshot() {
  const theme = document.documentElement.dataset.theme
  return theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
}
export function useDarkTheme() { return useSyncExternalStore(subscribe, snapshot, () => false) }
