export const ASSISTANT_OPEN_EVENT = 'casa-nostra:assistant'

/** Apertura contestuale; il testo resta modificabile prima dell’invio. */
export function openAssistant(prompt = '') {
  window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_EVENT, { detail: prompt }))
}
