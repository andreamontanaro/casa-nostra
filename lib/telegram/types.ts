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

export interface TelegramApiMessage {
  message_id: number
  from?: TelegramApiUser
  chat: TelegramApiChat
  date: number
  text?: string
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
