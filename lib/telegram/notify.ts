import { after } from 'next/server'
import { describeBalance, type BalanceRow } from '@/lib/balance'
import {
  CATEGORY_ICON,
  CATEGORY_LABELS,
  SHOPPING_CATEGORY_ICON,
  SHOPPING_CATEGORY_LABELS,
  SPLIT_LABELS,
  formatDate,
  formatEur,
} from '@/lib/fmt'
import { getTelegramConfig, isTelegramConfigured } from './config'
import { escapeHtml } from './format'
import { sendTelegramMessage } from './api'

/**
 * Accoda l'invio di una notifica al termine della risposta HTTP: l'utente non
 * aspetta la chiamata a Telegram, e un errore dell'integrazione non può far
 * fallire il salvataggio della spesa.
 */
export function notifyTelegram(html: string): void {
  if (!isTelegramConfigured()) return

  const send = async () => {
    try {
      await sendTelegramMessage(html)
    } catch (e) {
      console.error('[telegram] notifica non inviata:', e)
    }
  }

  try {
    after(send)
  } catch {
    // `after()` richiede un contesto di richiesta: se non c'è (es. dentro lo
    // stream di una risposta già iniziata) si parte comunque, senza attendere.
    void send()
  }
}

export interface ExpenseNotification {
  /** Chi ha compiuto l'azione nell'app. */
  actorName: string
  expenseId?: string
  amount: number
  description: string
  category: string
  splitRule: string
  payerName: string
  expenseDate: string
  /** Righe di v_user_open_balance lette dopo la modifica. */
  balance: BalanceRow[]
}

/** «Andrea ha aggiunto una spesa di 45,00 €», con il saldo aggiornato. */
export function expenseCreatedMessage(data: ExpenseNotification): string {
  return expenseMessage('💸', 'ha aggiunto una spesa', data)
}

export function expenseUpdatedMessage(data: ExpenseNotification): string {
  return expenseMessage('✏️', 'ha modificato una spesa', data)
}

export function expenseDeletedMessage(data: ExpenseNotification): string {
  return expenseMessage('🗑️', 'ha eliminato una spesa', data, { linkToExpense: false })
}

function expenseMessage(
  emoji: string,
  action: string,
  data: ExpenseNotification,
  options: { linkToExpense?: boolean } = {},
): string {
  const icon = CATEGORY_ICON[data.category] ?? '📦'
  const category = CATEGORY_LABELS[data.category] ?? data.category
  const split = SPLIT_LABELS[data.splitRule] ?? data.splitRule

  const lines = [
    `${emoji} <b>${escapeHtml(data.actorName)}</b> ${action}`,
    '',
    `${icon} <b>${formatEur(data.amount)}</b> — ${escapeHtml(data.description)}`,
    `<i>${escapeHtml(category)} · ${escapeHtml(split)} · pagata da ${escapeHtml(
      data.payerName,
    )} · ${formatDate(data.expenseDate)}</i>`,
    '',
    balanceLine(data.balance),
  ]

  const link =
    options.linkToExpense === false || !data.expenseId
      ? appLink('/spese', 'Apri lo storico')
      : appLink(`/spese/${data.expenseId}`, 'Apri la spesa')
  if (link) lines.push('', link)

  return lines.join('\n')
}

export interface SettlementNotification {
  actorName: string
  amount: number
  fromName: string
  toName: string
  expenseCount: number
  balance: BalanceRow[]
}

/** Conguaglio registrato: le spese selezionate sono state chiuse. */
export function settlementRegisteredMessage(data: SettlementNotification): string {
  const lines = [
    `🤝 <b>${escapeHtml(data.actorName)}</b> ha registrato un conguaglio`,
    '',
    `<b>${formatEur(data.amount)}</b> — ${escapeHtml(data.fromName)} → ${escapeHtml(data.toName)}`,
    `<i>${data.expenseCount} ${data.expenseCount === 1 ? 'spesa chiusa' : 'spese chiuse'}</i>`,
    '',
    balanceLine(data.balance),
  ]
  const link = appLink('/', 'Apri Casa Nostra')
  if (link) lines.push('', link)
  return lines.join('\n')
}

/**
 * Richiesta di conguaglio: nessuna scrittura sul database, solo un promemoria
 * nel gruppo. Il conguaglio vero si registra dall'app dopo il bonifico.
 */
export function settlementRequestedMessage(actorName: string, balance: BalanceRow[]): string {
  const summary = describeBalance(balance)
  const lines = [`🔔 <b>${escapeHtml(actorName)}</b> ha richiesto un conguaglio`, '']

  if (summary.creditor && summary.debtor) {
    lines.push(
      `<b>${formatEur(summary.amount)}</b> — ${escapeHtml(
        summary.debtor.display_name ?? '?',
      )} → ${escapeHtml(summary.creditor.display_name ?? '?')}`,
      '',
      '<i>Quando il bonifico è partito, registrate il conguaglio nell\'app.</i>',
    )
  } else {
    lines.push('Al momento i conti sono in pari, non c\'è niente da conguagliare.')
  }

  const link = appLink('/conguaglio', 'Vai al conguaglio')
  if (link) lines.push('', link)
  return lines.join('\n')
}

/**
 * Una tacca della bottiglia settimanale si è appena riempita — evento raro e
 * positivo condiviso, mai un confronto tra i due (docs/design-modulo-gestione-casa.md
 * §9 "Cose da NON fare"): nessun nome, nessun "chi ha fatto di più".
 */
export function choreNotchFilledMessage(filledNotches: number, maxNotches: number, goalReached: boolean): string {
  const lines = goalReached
    ? ['🎉 <b>Bottiglia piena!</b>', '', `${filledNotches}/${maxNotches} — obiettivo della settimana raggiunto.`]
    : ['🍾 <b>Tacca riempita!</b>', '', `${filledNotches}/${maxNotches} questa settimana, avanti così.`]

  const link = appLink('/casa', 'Apri Gestione casa')
  if (link) lines.push('', link)
  return lines.join('\n')
}

function balanceLine(balance: BalanceRow[]): string {
  const summary = describeBalance(balance)
  return summary.creditor && summary.debtor
    ? `📊 ${escapeHtml(summary.text)}`
    : '📊 Siete in pari.'
}

/**
 * Link assoluto all'app. Senza NEXT_PUBLIC_SITE_URL non c'è modo di costruirlo:
 * in quel caso la notifica resta senza link invece di mostrarne uno rotto.
 */
function appLink(path: string, label: string): string {
  const config = getTelegramConfig()
  if (!config?.siteUrl) return ''
  return `<a href="${config.siteUrl}${path}">${escapeHtml(label)}</a>`
}

// ------------------------------------------------------------
// Lista della spesa
// ------------------------------------------------------------

/**
 * Forma minima del risultato di un controllo scontrino. Dichiarata qui invece
 * di importare il tipo da `lib/shopping/service` per non trascinare l'SDK di
 * Gemini nel grafo di chi vuole solo comporre un messaggio.
 */
export interface ReceiptCheckSummary {
  storeName: string | null
  receiptTotal: number | null
  matched: { name: string }[]
  missing: { name: string; quantity: string | null; urgency: string }[]
}

/** Esito del controllo scontrino: cosa è stato spuntato e cosa manca ancora. */
export function receiptCheckMessage(check: ReceiptCheckSummary): string {
  const header = check.storeName
    ? `🧾 <b>Scontrino controllato</b> — ${escapeHtml(check.storeName)}`
    : '🧾 <b>Scontrino controllato</b>'

  const lines = [header, '']

  if (check.receiptTotal !== null) {
    lines.push(`<i>Totale letto: ${formatEur(check.receiptTotal)}</i>`, '')
  }

  if (check.matched.length > 0) {
    lines.push(
      `✅ <b>Spuntati ${check.matched.length}</b>`,
      check.matched.map((m) => `• ${escapeHtml(m.name)}`).join('\n'),
    )
  } else {
    lines.push('✅ Nessun articolo della lista riconosciuto sullo scontrino.')
  }

  if (check.missing.length > 0) {
    lines.push(
      '',
      `🛒 <b>Manca ancora ${check.missing.length}</b>`,
      check.missing
        .map(
          (m) =>
            `• ${escapeHtml(m.name)}${m.quantity ? ` <i>(${escapeHtml(m.quantity)})</i>` : ''}` +
            `${m.urgency === 'alta' ? ' ❗' : ''}`,
        )
        .join('\n'),
    )
  } else {
    lines.push('', '🎉 La lista è vuota: preso tutto.')
  }

  const link = appLink('/lista', 'Apri la lista della spesa')
  if (link) lines.push('', link)
  return lines.join('\n')
}

/**
 * Solo per un articolo segnato come urgente: è l'unico caso in cui l'altro ha
 * bisogno di saperlo prima di passare al supermercato. Ogni aggiunta alla
 * lista nel gruppo diventerebbe rumore di fondo.
 */
export function urgentItemAddedMessage(
  actorName: string,
  itemName: string,
  quantity: string | null,
): string {
  const lines = [
    `❗ <b>${escapeHtml(actorName)}</b> ha aggiunto una cosa urgente in lista`,
    '',
    `🛒 <b>${escapeHtml(itemName)}</b>${quantity ? ` — ${escapeHtml(quantity)}` : ''}`,
  ]
  const link = appLink('/lista', 'Apri la lista della spesa')
  if (link) lines.push('', link)
  return lines.join('\n')
}

/** La lista corrente, raggruppata per categoria: risposta al comando /lista. */
export function shoppingListMessage(
  items: { name: string; quantity: string | null; urgency: string; category: string }[],
): string {
  if (items.length === 0) {
    return '🛒 <b>Lista della spesa</b>\n\nNon manca niente: la lista è vuota.'
  }

  const lines = [`🛒 <b>Lista della spesa</b> — ${items.length} ${items.length === 1 ? 'articolo' : 'articoli'}`, '']

  const byCategory = new Map<string, typeof items>()
  for (const item of items) {
    const list = byCategory.get(item.category) ?? []
    list.push(item)
    byCategory.set(item.category, list)
  }

  for (const [category, list] of byCategory) {
    lines.push(
      `${SHOPPING_CATEGORY_ICON[category] ?? '📦'} <b>${escapeHtml(
        SHOPPING_CATEGORY_LABELS[category] ?? category,
      )}</b>`,
    )
    for (const item of list) {
      lines.push(
        `• ${escapeHtml(item.name)}${item.quantity ? ` <i>(${escapeHtml(item.quantity)})</i>` : ''}` +
          `${item.urgency === 'alta' ? ' ❗' : ''}`,
      )
    }
    lines.push('')
  }

  const link = appLink('/lista', 'Apri la lista della spesa')
  if (link) lines.push(link)
  return lines.join('\n').trim()
}
