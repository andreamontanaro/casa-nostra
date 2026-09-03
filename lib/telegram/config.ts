/**
 * Configurazione dell'integrazione Telegram, letta dalle variabili d'ambiente.
 * Tutte server-side: nessuna ha il prefisso NEXT_PUBLIC_.
 */
export interface TelegramConfig {
  /** Token del bot ottenuto da @BotFather. */
  botToken: string
  /**
   * Id della chat di gruppo in cui il bot pubblica le notifiche. Può essere
   * vuoto durante la configurazione iniziale: è il valore che si scopre proprio
   * scrivendo `/id` nel gruppo, quindi il webhook deve poter rispondere a quel
   * comando prima di conoscerlo.
   */
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
 * Configurazione del bot, se esiste un token con cui parlare con Telegram.
 * Il solo token basta per rispondere a `/id` in fase di bootstrap; per pubblicare
 * notifiche serve anche `chatId` (vedi `isTelegramConfigured`), e il secret lo
 * verifica il webhook per conto suo.
 */
export function getTelegramConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!botToken) return null

  const replyMode = process.env.TELEGRAM_REPLY_MODE?.trim() === 'all' ? 'all' : 'mention'

  return {
    botToken,
    chatId: process.env.TELEGRAM_CHAT_ID?.trim() ?? '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? '',
    botUsername: (process.env.TELEGRAM_BOT_USERNAME?.trim() ?? '').replace(/^@/, ''),
    replyMode,
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? '').replace(/\/$/, ''),
  }
}

/**
 * L'integrazione è completa: c'è un bot e c'è un gruppo dove scrivere. È la
 * condizione che governa notifiche e comandi diversi da `/id`; con il solo token
 * il bot esiste ma non ha ancora una casa.
 */
export function isTelegramConfigured(): boolean {
  const config = getTelegramConfig()
  return config !== null && config.chatId !== ''
}
