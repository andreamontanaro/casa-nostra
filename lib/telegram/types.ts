// Sottoinsieme dei tipi dell'API Bot di Telegram effettivamente usato dal webhook.
// https://core.telegram.org/bots/api#update

export interface TelegramApiUser {
  id: number
  is_bot?: boolean
  first_name?: string
  last_name?: string
  username?: string
}

export interface TelegramApiChat {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  title?: string
}

/** Una delle dimensioni in cui Telegram consegna una foto. */
export interface TelegramPhotoSize {
  file_id: string
  file_unique_id: string
  width: number
  height: number
  file_size?: number
}

/** File inviato come documento (es. lo scontrino in PDF, o una foto "senza compressione"). */
export interface TelegramApiDocument {
  file_id: string
  file_unique_id: string
  file_name?: string
  mime_type?: string
  file_size?: number
}

export interface TelegramApiMessage {
  message_id: number
  from?: TelegramApiUser
  chat: TelegramApiChat
  date: number
  text?: string
  /** Didascalia di foto e documenti: per il bot vale quanto `text`. */
  caption?: string
  /** Stesse foto in piu' risoluzioni, dalla piu' piccola alla piu' grande. */
  photo?: TelegramPhotoSize[]
  document?: TelegramApiDocument
  reply_to_message?: TelegramApiMessage
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramApiMessage
  edited_message?: TelegramApiMessage
}

/** Nome con cui riferirsi a chi ha scritto, quando non è collegato a un profilo. */
export function telegramDisplayName(user: TelegramApiUser | undefined): string {
  if (!user) return 'Sconosciuto'
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return full || user.username || `utente ${user.id}`
}
