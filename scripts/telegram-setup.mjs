#!/usr/bin/env node
/**
 * Registra (o rimuove) il webhook del bot Telegram.
 *
 *   node scripts/telegram-setup.mjs chats                                    # id delle chat che hanno scritto al bot
 *   node scripts/telegram-setup.mjs set    https://casa-nostra.vercel.app
 *   node scripts/telegram-setup.mjs info
 *   node scripts/telegram-setup.mjs delete
 *
 * Legge TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SECRET dall'ambiente (o da
 * .env.local, se presente). Nessuna dipendenza esterna: solo fetch di Node.
 */

import { readFileSync } from 'node:fs'

loadEnvLocal()

const [command = 'info', baseUrl] = process.argv.slice(2)
const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()

if (!token) {
  fail('Manca TELEGRAM_BOT_TOKEN (ambiente o .env.local).')
}

switch (command) {
  case 'set': {
    if (!baseUrl) fail('Uso: node scripts/telegram-setup.mjs set <url-pubblico-app>')
    if (!secret) fail('Manca TELEGRAM_WEBHOOK_SECRET: senza secret il webhook rifiuta tutto.')

    const url = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`
    const result = await api('setWebhook', {
      url,
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    })
    console.log(`Webhook registrato su ${url}`)
    console.log(result)
    break
  }

  case 'delete': {
    console.log(await api('deleteWebhook', { drop_pending_updates: true }))
    break
  }

  case 'chats': {
    // Scopre l'id del gruppo senza bisogno dell'app: Telegram tiene in coda gli
    // update recenti e qui li si legge direttamente. Funziona solo se il webhook
    // non è attivo (le due modalità si escludono a vicenda).
    const updates = await api('getUpdates', { allowed_updates: ['message'], limit: 100 })

    const chats = new Map()
    for (const update of updates) {
      const chat = update.message?.chat
      if (!chat) continue
      chats.set(chat.id, chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(' '))
    }

    if (chats.size === 0) {
      console.log('Nessun messaggio in coda.')
      console.log('Scrivi qualcosa nel gruppo (es. /id) e rilancia questo comando.')
      break
    }

    console.log('Chat che hanno scritto al bot:\n')
    for (const [id, name] of chats) {
      const kind = id < 0 ? 'gruppo' : 'chat privata'
      console.log(`  ${id}  ${name || '(senza nome)'}  — ${kind}`)
    }
    console.log('\nL\'id negativo è quello del gruppo: va in TELEGRAM_CHAT_ID.')
    break
  }

  case 'info': {
    const me = await api('getMe', {})
    console.log(`Bot: @${me.username} (${me.first_name})`)
    console.log('Webhook:', await api('getWebhookInfo', {}))
    break
  }

  default:
    fail(`Comando sconosciuto: ${command}. Usa chats | set | info | delete.`)
}

async function api(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json()
  if (!body.ok) {
    if (method === 'getUpdates' && res.status === 409) {
      fail(
        'Il webhook è attivo, quindi Telegram non consente di leggere gli update qui.\n' +
          '  Rimuovilo con "delete", rilancia "chats", poi rimettilo con "set".',
      )
    }
    fail(`${method} fallito: ${body.description ?? res.status}`)
  }
  return body.result
}

/** Carica .env.local senza dipendenze: bastano le righe CHIAVE=valore. */
function loadEnvLocal() {
  let content
  try {
    content = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch {
    return
  }
  for (const line of content.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key]) continue
    process.env[key] = rawValue.replace(/^["']|["']$/g, '')
  }
}

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}
