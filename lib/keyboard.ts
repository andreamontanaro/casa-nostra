/**
 * Misure della tastiera software, separate perché servono a due cose diverse.
 *
 * `height` è quanto spazio verticale la tastiera toglie alla parte visibile
 * della finestra: è il numero da sottrarre alle **altezze**.
 *
 * `inset` è la distanza dal fondo del layout viewport a cui va appoggiato un
 * elemento `position: fixed` perché si fermi sopra la tastiera: è il numero da
 * dare a **`bottom`**.
 *
 * I due valori coincidono finché il browser si limita a rimpicciolire il
 * viewport visuale. Divergono quando iOS, invece, **spinge su tutta la pagina**
 * per scoprire il campo a fuoco (succede tipicamente nella PWA installata, con
 * il body bloccato da una modale): lì `offsetTop` è di quanto ha spinto, la
 * pagina si è già spostata da sé e `bottom` non deve aggiungere altro — ma
 * l'altezza disponibile resta accorciata dalla tastiera. Usare un solo numero
 * per entrambe le cose lascia il fondo al posto giusto e manda la testa del
 * contenuto (l'intestazione, i primi campi) fuori dallo schermo.
 */
export interface KeyboardMetrics {
  /** Spazio rubato dalla tastiera: da sottrarre alle altezze. */
  height: number
  /** Distanza dal fondo del layout viewport per un `fixed` che sta sopra la tastiera. */
  inset: number
}

export const NO_KEYBOARD: KeyboardMetrics = { height: 0, inset: 0 }

/**
 * @param layoutHeight  `window.innerHeight` — non cambia con la tastiera su iOS.
 * @param viewportHeight `visualViewport.height` — la parte di finestra visibile.
 * @param viewportOffsetTop `visualViewport.offsetTop` — di quanto il browser ha
 *   spinto su la pagina da solo.
 * @param minKeyboard soglia sotto la quale non è una tastiera ma la barra degli
 *   indirizzi che si ritrae (o un arrotondamento): trattarla come tastiera fa
 *   sfarfallare il layout.
 */
export function measureKeyboard(
  layoutHeight: number,
  viewportHeight: number,
  viewportOffsetTop: number,
  minKeyboard = 120,
): KeyboardMetrics {
  const height = Math.round(layoutHeight - viewportHeight)
  if (!(height >= minKeyboard)) return NO_KEYBOARD

  return { height, inset: Math.max(0, Math.round(height - viewportOffsetTop)) }
}
