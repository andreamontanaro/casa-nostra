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

/** XP che un kudos accredita all'obiettivo di casa (non a chi lo dà o riceve). */
export const KUDOS_XP = 3

export const KUDOS_EMOJIS = ['❤️', '🙏', '👏', '💪'] as const
