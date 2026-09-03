/**
 * Configurazione dell'integrazione Telegram, letta dalle variabili d'ambiente.
 * Tutte server-side: nessuna ha il prefisso NEXT_PUBLIC_.
 */
export interface TelegramConfig {
  /** Token del bot ottenuto da @BotFather. */
  botToken: string
  /** Id della chat di gruppo in cui il bot pubblica le notifiche. */
  chatId: string
  /** Secret condiviso con Telegram e verificato a ogni update in arrivo. */
  webhookSecret: string
  /** Username del bot (senza @): serve a riconoscere le menzioni nel gruppo. */
  botUsername: string
  /**
   * Quando l'assistente risponde nel gruppo:
   *  - 'mention' (default): solo comandi, menzioni @bot e risposte a un suo messaggio
   *  - 'all': ogni messaggio di testo del gruppo
   */
  replyMode: 'mention' | 'all'
  /** URL pubblico dell'app, per i link nei messaggi (es. https://casa-nostra.vercel.app). */
  siteUrl: string
}

/**
 * Restituisce la configurazione se l'integrazione è utilizzabile, altrimenti null.
 * Bot token e chat id sono il minimo indispensabile per notificare; il secret è
 * richiesto solo dal webhook, che lo verifica a parte.
 */
export function getTelegramConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim()
  if (!botToken || !chatId) return null

  const replyMode = process.env.TELEGRAM_REPLY_MODE?.trim() === 'all' ? 'all' : 'mention'

  return {
    botToken,
    chatId,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? '',
    botUsername: (process.env.TELEGRAM_BOT_USERNAME?.trim() ?? '').replace(/^@/, ''),
    replyMode,
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? '').replace(/\/$/, ''),
  }
}

export function isTelegramConfigured(): boolean {
  return getTelegramConfig() !== null
}
