/**
 * Costanti del modulo "Gestione casa" — fase 2 (obiettivo, striscia,
 * equilibrio, kudos). Tenute qui e non sparse nei componenti perché sono i
 * primi numeri da rivedere dopo un mese d'uso reale (vedi
 * docs/design-modulo-gestione-casa.md).
 */

/**
 * Obiettivo XP settimanale di casa. Valore PROVVISORIO (70% del tetto
 * teorico del catalogo, 668 XP/settimana a cadenza piena calcolato in
 * progettazione): non ci sono ancora dati reali da cui ricavare una
 * mediana. Da ritarare sui dati delle prime settimane d'uso vero.
 */
export const WEEKLY_GOAL_XP = 475

/**
 * Zona morta della barra di equilibrio: qualsiasi ripartizione in questo
 * intervallo è etichettata "in equilibrio", senza percentuali. Allargata da
 * 35–65% (ipotesi iniziale) a 30–70% già in fase di progettazione: con una
 * persona che lavora fuori casa tutto il giorno, una divisione asimmetrica
 * delle faccende non è uno squilibrio da segnalare.
 */
export const BALANCE_DEAD_BAND_LOW = 30
export const BALANCE_DEAD_BAND_HIGH = 70

/** XP che un kudos accredita all'obiettivo di casa (non a chi lo dà o riceve). */
export const KUDOS_XP = 3

export const KUDOS_EMOJIS = ['❤️', '🙏', '👏', '💪'] as const
