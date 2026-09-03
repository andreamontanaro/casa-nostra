// Formattazione dei messaggi per Telegram.
//
// Telegram accetta un sottoinsieme minuscolo di HTML (<b>, <i>, <s>, <code>,
// <pre>, <a href>) e rifiuta con 400 qualsiasi tag o entità fuori posto. Gemini
// però risponde in Markdown, quindi convertiamo qui il Markdown che l'assistente
// produce davvero, scartando il resto.

const MAX_MESSAGE_LENGTH = 4096
// Margine di sicurezza: la conversione può allungare il testo (&amp;, <b>…).
const CHUNK_LENGTH = 3500

// Segnaposto usato per mettere da parte i frammenti già convertiti in HTML: il
// NUL non è producibile dal modello, quindi non collide con il testo reale.
const NUL = String.fromCharCode(0)

/** Rende sicuro un testo qualsiasi dentro un messaggio HTML di Telegram. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Converte il Markdown dell'assistente nell'HTML supportato da Telegram.
 * I link relativi (es. `/spese/ID`) vengono resi assoluti con `baseUrl`; se
 * `baseUrl` manca resta solo il testo del link, perché un href relativo su
 * Telegram non è cliccabile.
 */
export function markdownToTelegramHtml(markdown: string, baseUrl = ''): string {
  // I frammenti già in HTML vengono messi da parte prima delle sostituzioni
  // successive, così il loro contenuto non viene reinterpretato come Markdown.
  const stash: string[] = []
  const keep = (html: string) => `${NUL}${stash.push(html) - 1}${NUL}`

  let out = escapeHtml(markdown.split(NUL).join(''))

  out = out.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, (_, code: string) =>
    keep(`<pre>${code.replace(/\n$/, '')}</pre>`),
  )
  out = out.replace(/`([^`\n]+)`/g, (_, code: string) => keep(`<code>${code}</code>`))

  // Link: [testo](url). Gli url relativi diventano assoluti, o perdono l'href.
  out = out.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => {
    let target = href
    if (target.startsWith('/')) {
      if (!baseUrl) return label
      target = `${baseUrl}${target}`
    } else if (!/^https?:\/\//.test(target)) {
      return label
    }
    return keep(`<a href="${target}">${label}</a>`)
  })

  out = out
    // Titoli Markdown: Telegram non li ha, diventano righe in grassetto.
    .replace(/^#{1,6}\s+(.*)$/gm, '<b>$1</b>')
    // Elenchi puntati: il trattino/asterisco iniziale diventa un bullet.
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/__([^_\n]+)__/g, '<b>$1</b>')
    .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, '$1<i>$2</i>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:!?)]|$)/g, '$1<i>$2</i>')

  const placeholder = new RegExp(`${NUL}(\\d+)${NUL}`, 'g')
  return out.replace(placeholder, (_, i: string) => stash[Number(i)] ?? '')
}

/** Riporta un messaggio HTML a testo semplice (fallback e memoria della chat). */
export function htmlToPlain(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/**
 * Spezza un messaggio lungo nei pezzi accettati da Telegram, tagliando dove
 * possibile a fine riga per non spaccare una frase (o un tag) a metà.
 */
export function splitMessage(text: string, limit = CHUNK_LENGTH): string[] {
  if (text.length <= limit) return [text]

  const chunks: string[] = []
  let rest = text

  while (rest.length > limit) {
    const window = rest.slice(0, limit)
    const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'))
    const at = cut > limit * 0.5 ? cut : limit
    chunks.push(rest.slice(0, at).trimEnd())
    rest = rest.slice(at).trimStart()
  }

  if (rest) chunks.push(rest)
  return chunks
}

export { MAX_MESSAGE_LENGTH }
