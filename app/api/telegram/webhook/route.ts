import { after } from 'next/server'
import { runAssistant } from '@/lib/assistant/run'
import { describeBalance } from '@/lib/balance'
import { formatEur } from '@/lib/fmt'
import { getOpenBalance, getProfiles } from '@/lib/queries'
import { createServiceClient, type ServiceClient } from '@/lib/supabase/service'
import { sendTelegramMessage, sendTypingAction } from '@/lib/telegram/api'
import { getTelegramConfig, type TelegramConfig } from '@/lib/telegram/config'
import {
  claimUpdate,
  loadHistory,
  pruneHistory,
  saveAssistantReply,
} from '@/lib/telegram/conversation'
import { escapeHtml, htmlToPlain, markdownToTelegramHtml } from '@/lib/telegram/format'
import { settlementRequestedMessage } from '@/lib/telegram/notify'
import {
  telegramDisplayName,
  type TelegramApiMessage,
  type TelegramUpdate,
} from '@/lib/telegram/types'

// Come l'assistente dell'app: SDK Gemini e download degli allegati richiedono Node.
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Webhook del bot Telegram.
 *
 * Telegram considera la consegna riuscita solo se rispondiamo in fretta e
 * ripete l'update altrimenti: qui si risponde subito 200 e si elabora il
 * messaggio dopo la risposta, con `after()`. La difesa da doppioni è
 * l'`update_id` UNIQUE su telegram_messages.
 */
export async function POST(request: Request) {
  const config = getTelegramConfig()
  // Integrazione non configurata: si accetta e si ignora, così Telegram non
  // riprova all'infinito.
  if (!config) return acknowledge()

  if (!config.webhookSecret) {
    console.error('[telegram] TELEGRAM_WEBHOOK_SECRET non configurato: update rifiutato.')
    return new Response('Webhook non configurato', { status: 500 })
  }

  // Unico controllo di autenticità disponibile: il secret che Telegram rimanda
  // a ogni update, impostato al momento della setWebhook.
  if (request.headers.get('x-telegram-bot-api-secret-token') !== config.webhookSecret) {
    return new Response('Non autorizzato', { status: 403 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return acknowledge()
  }

  const message = update.message
  const text = message?.text?.trim()
  if (!message || !text || message.from?.is_bot) return acknowledge()

  // Si risponde solo nel gruppo configurato e nelle chat private col bot: se
  // qualcuno lo aggiunge altrove, resta muto.
  const isConfiguredGroup = String(message.chat.id) === config.chatId
  const isPrivate = message.chat.type === 'private'
  if (!isConfiguredGroup && !isPrivate) return acknowledge()

  const command = parseCommand(text, config.botUsername)
  if (command === 'other-bot') return acknowledge()

  if (!shouldReply({ message, text, command, config, isPrivate })) return acknowledge()

  after(async () => {
    try {
      await handleMessage({ update, message, text, command, config })
    } catch (e) {
      console.error('[telegram] elaborazione fallita:', e)
      await sendTelegramMessage(
        '⚠️ Qualcosa è andato storto mentre elaboravo il messaggio. Riprova tra poco.',
        { chatId: message.chat.id, replyTo: message.message_id },
      )
    }
  })

  return acknowledge()
}

function acknowledge() {
  return Response.json({ ok: true })
}

interface ParsedCommand {
  name: string
  args: string
}

/**
 * Riconosce i comandi in stile Telegram (`/saldo`, `/spesa 12€ pizza`,
 * `/aiuto@casanostra_bot`). Se il comando è indirizzato a un altro bot del
 * gruppo restituisce 'other-bot' e il messaggio va ignorato.
 */
function parseCommand(text: string, botUsername: string): ParsedCommand | null | 'other-bot' {
  const match = /^\/([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9_]+))?(?:\s+([\s\S]*))?$/.exec(text)
  if (!match) return null

  const [, name, addressee, args] = match
  if (addressee && botUsername && addressee.toLowerCase() !== botUsername.toLowerCase()) {
    return 'other-bot'
  }

  return { name: name.toLowerCase(), args: (args ?? '').trim() }
}

/**
 * Nel gruppo il bot non interviene su tutto: risponde ai comandi, quando viene
 * menzionato e quando si risponde a un suo messaggio (o sempre, se
 * TELEGRAM_REPLY_MODE=all). In chat privata risponde a qualsiasi messaggio.
 */
function shouldReply(params: {
  message: TelegramApiMessage
  text: string
  command: ParsedCommand | null
  config: TelegramConfig
  isPrivate: boolean
}): boolean {
  const { message, text, command, config, isPrivate } = params
  if (isPrivate || command || config.replyMode === 'all') return true

  if (config.botUsername) {
    const mention = new RegExp(`@${config.botUsername}(?![a-zA-Z0-9_])`, 'i')
    if (mention.test(text)) return true
  }

  const repliedTo = message.reply_to_message?.from
  if (repliedTo?.is_bot) {
    return (
      !config.botUsername ||
      repliedTo.username?.toLowerCase() === config.botUsername.toLowerCase()
    )
  }

  return false
}

async function handleMessage(params: {
  update: TelegramUpdate
  message: TelegramApiMessage
  text: string
  command: ParsedCommand | null
  config: TelegramConfig
}) {
  const { update, message, text, command, config } = params
  const chatId = message.chat.id
  const isGroup = message.chat.type !== 'private'
  const senderName = telegramDisplayName(message.from)

  const db = createServiceClient()

  // Il testo destinato all'assistente: senza la menzione e senza il comando.
  const prompt = stripAddressing(text, command, config.botUsername)

  // Primo passo: prende in carico l'update. Se era già stato elaborato
  // (riconsegna di Telegram), qui si ferma.
  const isNew = await claimUpdate(db, {
    chatId,
    updateId: update.update_id,
    senderName,
    content: prompt || text,
  })
  if (!isNew) return

  // `memory` è ciò che finisce nella cronologia data all'assistente: il testo
  // senza tag, così i turni precedenti restano leggibili per il modello.
  const reply = async (html: string, memory?: string) => {
    await sendTelegramMessage(html, {
      chatId,
      replyTo: isGroup ? message.message_id : undefined,
    })
    await saveAssistantReply(db, chatId, memory ?? htmlToPlain(html))
  }

  // /id funziona anche per chi non è ancora collegato: serve proprio a
  // completare la configurazione.
  if (command?.name === 'id') {
    await reply(idMessage(chatId, message.from?.id))
    return
  }

  const profiles = await getProfiles(db)
  // Il bigint di Postgres può arrivare come numero o come stringa a seconda del
  // driver: si confrontano i valori normalizzati.
  const senderTelegramId = message.from?.id
  const sender = profiles.find(
    (p) => p.telegram_user_id != null && Number(p.telegram_user_id) === senderTelegramId,
  )

  if (!sender) {
    await reply(
      [
        `👋 Ciao ${escapeHtml(senderName)}, non ti riconosco.`,
        '',
        'Per usare l\'assistente collega il tuo account Telegram in <b>Impostazioni → Telegram</b> dentro Casa Nostra.',
        `Il tuo id Telegram è <code>${message.from?.id ?? '?'}</code>.`,
      ].join('\n'),
    )
    return
  }

  switch (command?.name) {
    case 'start':
    case 'aiuto':
    case 'help':
      await reply(helpMessage())
      return

    case 'saldo':
      await reply(await balanceMessage(db))
      return

    case 'conguaglio':
      // Solo un promemoria nel gruppo: il conguaglio si registra dall'app,
      // dopo il bonifico.
      await reply(
        settlementRequestedMessage(sender.display_name, await getOpenBalance(db)),
      )
      return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    await reply('⚠️ L\'assistente non è configurato: manca la chiave API di Gemini.')
    return
  }

  await sendTypingAction(chatId)

  // La cronologia include già il messaggio appena registrato da claimUpdate.
  const history = await loadHistory(db, chatId)

  const answer = await runAssistant({
    messages: history,
    userId: sender.id,
    db,
    channel: 'telegram',
    apiKey,
  })

  const clean = answer.trim()
  if (clean) {
    await reply(markdownToTelegramHtml(clean, config.siteUrl), clean)
  } else {
    await reply('Non sono riuscito a formulare una risposta. Riprova a chiedermelo in altro modo.')
  }

  await pruneHistory(db)
}

// Comandi che non hanno una risposta "fissa" ma girano all'assistente: quando
// arrivano senza argomenti si trasformano nella richiesta per esteso.
const COMMAND_PROMPTS: Record<string, string> = {
  recap: 'Fammi un recap delle spese di questo mese: totale, divisione per categoria e come sta il saldo.',
  spesa: 'Vorrei aggiungere una spesa.',
}

/** Toglie dal testo la menzione al bot e il comando iniziale. */
function stripAddressing(
  text: string,
  command: ParsedCommand | null,
  botUsername: string,
): string {
  let out = text
  if (command) {
    out = command.args || COMMAND_PROMPTS[command.name] || command.name
  }
  if (botUsername) {
    out = out.replace(new RegExp(`@${botUsername}(?![a-zA-Z0-9_])`, 'gi'), ' ')
  }
  return out.replace(/\s+/g, ' ').trim()
}

function idMessage(chatId: number, userId: number | undefined): string {
  return [
    '🔧 <b>Dati per la configurazione</b>',
    '',
    `Chat: <code>${chatId}</code>`,
    `Il tuo account Telegram: <code>${userId ?? '?'}</code>`,
    '',
    '<i>La chat va in TELEGRAM_CHAT_ID; l\'id personale si collega da Impostazioni → Telegram.</i>',
  ].join('\n')
}

function helpMessage(): string {
  return [
    '🏠 <b>Casa Nostra</b>',
    '',
    'Scrivimi menzionandomi o rispondendo a un mio messaggio:',
    '• «ho pagato 32€ di spesa al Lidl» — registro la spesa (prima ti chiedo conferma)',
    '• «quanto devo?» — il saldo aggiornato',
    '• «recap delle spese di questo mese» — un riepilogo',
    '',
    '<b>Comandi</b>',
    '/saldo — saldo corrente',
    '/recap — riepilogo delle spese del mese',
    '/spesa &lt;testo&gt; — aggiungi una spesa',
    '/conguaglio — chiedi il conguaglio all\'altra persona',
    '/id — id di chat e account, per la configurazione',
    '/aiuto — questo messaggio',
  ].join('\n')
}

async function balanceMessage(db: ServiceClient): Promise<string> {
  const summary = describeBalance(await getOpenBalance(db))
  if (!summary.creditor || !summary.debtor) {
    return '📊 <b>Saldo</b>\n\nSiete in pari, non c\'è niente da conguagliare.'
  }
  return [
    '📊 <b>Saldo</b>',
    '',
    `<b>${formatEur(summary.amount)}</b> — ${escapeHtml(
      summary.debtor.display_name ?? '?',
    )} → ${escapeHtml(summary.creditor.display_name ?? '?')}`,
    '',
    '<i>Solo spese aperte, non ancora saldate.</i>',
  ].join('\n')
}
