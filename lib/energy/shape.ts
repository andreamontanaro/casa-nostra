/**
 * La forma di una risposta di Fastweb, senza i dati: serve solo alla modalità
 * diagnostica di `/api/energia` (mai in produzione) per scrivere i parser di
 * `readings.ts`. Funzione pura, senza import, testata in `tests/energy.test.mjs`.
 *
 * - le chiavi che possono contenere dati dell'intestatario spariscono;
 * - i numeri restano (sono watt, kWh, date in millisecondi);
 * - le stringhe restano solo se sembrano etichette ("frigo", "2026-10-14"):
 *   email, codici fiscali e lunghe sequenze di cifre (POD, numero cliente)
 *   diventano "‹testo, N caratteri›";
 * - degli array si mostrano la lunghezza e i primi elementi.
 */

// Parole che, dentro una chiave (`realtime_sin`, `codiceCliente`, …), dicono
// che il valore riguarda l'intestatario. `name` no: è il nome degli apparecchi.
const PERSONAL_WORDS = new Set([
  'sin', 'cf', 'codice', 'fiscale', 'codicefiscale', 'email', 'mail', 'pod', 'cliente', 'customer',
  'nome', 'cognome', 'surname', 'firstname', 'lastname', 'indirizzo', 'address', 'iban', 'telefono',
  'phone', 'cellulare', 'mobile', 'intestatario', 'user', 'username', 'utente', 'contratto', 'contract',
])

function isPersonalKey(key: string): boolean {
  return key.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/).some((word) => PERSONAL_WORDS.has(word))
}

const CODICE_FISCALE = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i
const MAX_DEPTH = 6
const MAX_ITEMS = 3

function maskString(text: string): string {
  const clean = text.trim()
  const looksPersonal = clean.length > 40 || clean.includes('@') || /\d{5,}/.test(clean.replace(/^\d{4}-\d{2}-\d{2}/, '')) || CODICE_FISCALE.test(clean)
  return looksPersonal ? `‹testo, ${clean.length} caratteri›` : clean
}

export function describeShape(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') return maskString(value)
  if (depth >= MAX_DEPTH) return '‹…›'
  if (Array.isArray(value)) {
    return { '‹array›': value.length, primi: value.slice(0, MAX_ITEMS).map((item) => describeShape(item, depth + 1)) }
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      out[key] = isPersonalKey(key) ? '‹tolto›' : describeShape(item, depth + 1)
    }
    return out
  }
  return `‹${typeof value}›`
}
