export const APP_MENU_OPEN_EVENT = 'casa-nostra:menu'

/**
 * Apre il menu con tutte le schermate (`components/AppMenu.tsx`). Il bottone
 * sta nell'intestazione di ogni pagina, il foglio una volta sola nel layout:
 * si parlano con un evento, come l'assistente (`lib/assistant/ui.ts`).
 */
export function openAppMenu() {
  window.dispatchEvent(new CustomEvent(APP_MENU_OPEN_EVENT))
}
