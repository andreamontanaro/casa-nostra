import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from 'node:crypto'

/**
 * Cifratura della sessione MyFastweb salvata su Supabase.
 *
 * I cookie di una sessione aperta valgono quanto la password: chi li ha entra
 * in MyFastweb. Sul database stanno quindi cifrati (AES-256-GCM) con una
 * chiave derivata dalle credenziali, che vivono solo nelle variabili
 * d'ambiente. Un dump della tabella da solo non serve a niente; se la
 * password cambia la sessione salvata non si apre più e si rifà il login.
 *
 * scrypt e non un hash veloce: rende lenta la prova di password a tentativi
 * su una copia della tabella. Costa ~50 ms, una volta per istanza.
 */

const SALT = 'casa-nostra/energia/fastweb-v1'
const VERSION = 'v1'

export function deriveSessionKey(username: string, password: string): Buffer {
  return scryptSync(`${username}\u0000${password}`, SALT, 32, { N: 16384, r: 8, p: 1 })
}

/**
 * Impronta delle credenziali, per ricordare per chi vale un blocco (captcha,
 * credenziali rifiutate): con credenziali nuove si riprova subito.
 */
export function credentialsFingerprint(key: Buffer): string {
  return createHmac('sha256', key).update('impronta delle credenziali').digest('hex').slice(0, 16)
}

export function sealJson(key: Buffer, value: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.')
}

/** null se il testo non si apre con questa chiave (password cambiata, dato rovinato). */
export function openJson(key: Buffer, sealed: string): unknown {
  const [version, iv, tag, body] = sealed.split('.')
  if (version !== VERSION || !iv || !tag || !body) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    const text = Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8')
    return JSON.parse(text)
  } catch {
    return null
  }
}
