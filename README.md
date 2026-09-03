# Casa Nostra

App web mobile-first per la gestione trasparente delle spese di casa tra due persone conviventi. Ogni spesa inserita è condivisa per definizione: 50/50 per l'affitto, 60/40 per tutto il resto (il partner con reddito maggiore paga il 60%). L'app mostra sempre il saldo aggiornato e permette di chiuderlo con un conguaglio in un tap.

Per una guida completa all'architettura, ai modelli di dominio e ai pattern usati nel progetto, vedi la **[Wiki dello Sviluppatore](docs/wiki/00-index.md)**.

## Stack tecnico

- [Next.js](https://nextjs.org) 16 (App Router, Turbopack)
- [React](https://react.dev) 19
- [Tailwind CSS](https://tailwindcss.com) v4
- [Supabase](https://supabase.com) (Postgres + Auth + Storage)
- [Google Gemini](https://ai.google.dev) (`@google/genai`) per l'assistente IA
- TypeScript

## Prerequisiti

- Node.js 20 o superiore
- Un progetto [Supabase](https://supabase.com) (gratuito) con accesso al pannello di amministrazione
- Una API key [Google AI Studio](https://aistudio.google.com/apikey) per l'assistente IA (Gemini)

## Setup del progetto

### 1. Installazione dipendenze

```bash
npm install
```

### 2. Configurazione del database Supabase

Lo schema del database (tabelle, viste, RPC, RLS) è definito in [`docs/casa_nostra_schema.sql`](docs/casa_nostra_schema.sql) ed è la fonte autoritativa dello schema applicato.

1. Crea un nuovo progetto su [supabase.com](https://supabase.com).
2. Apri l'**SQL Editor** del progetto ed esegui per intero il contenuto di `docs/casa_nostra_schema.sql`.
3. L'app è pensata per esattamente due utenti fissi, creati manualmente (non esiste una pagina di signup pubblica):
   - Vai su **Authentication → Users → Add user** e crea i due account (email + password).
   - Copia gli UUID generati e inserisci le due righe corrispondenti in `public.profiles`, seguendo l'esempio nella sezione 9 (`BOOTSTRAP dei due profili`) in fondo allo script SQL.
4. Recupera **URL** e **anon key** del progetto da **Project Settings → API**: ti serviranno al passo successivo.

### 3. Variabili d'ambiente

Crea un file `.env.local` nella root del progetto (ignorato da Git) con le seguenti variabili. Il dettaglio di ciascuna è documentato in [`docs/wiki/06-configuration.md`](docs/wiki/06-configuration.md).

```bash
# Supabase — Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://<il-tuo-progetto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-del-progetto>

# Google Gemini — assistente IA (route /api/assistant)
GEMINI_API_KEY=<la-tua-api-key-google-ai-studio>
# Opzionale — default: gemini-flash-lite-latest
GEMINI_MODEL=gemini-flash-lite-latest
```

| Variabile | Obbligatoria | Ambito | Descrizione |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sì | Client + Server | Endpoint API del progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sì | Client + Server | Chiave pubblica "anon" Supabase, abilita la RLS |
| `GEMINI_API_KEY` | Sì | Server (segreta) | Credenziale per le chiamate all'API Google Gemini |
| `GEMINI_MODEL` | No | Server | Modello Gemini da usare (fallback: `gemini-flash-lite-latest`) |

### 4. Avvio in sviluppo

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000). Verrai reindirizzato a `/login`: accedi con una delle due utenze create al passo 2.

## Script disponibili

```bash
npm run dev     # server di sviluppo (Turbopack)
npm run build   # build di produzione
npm run start   # avvia la build di produzione
npm run lint    # lint del codice (ESLint)
```

## Deploy

Il deploy di riferimento è su [Vercel](https://vercel.com):

1. Importa la repository su Vercel.
2. Configura le stesse variabili d'ambiente del passo 3 nelle **Project Settings → Environment Variables** di Vercel.
3. Il deploy parte automaticamente ad ogni push sul branch di produzione.

Consulta la [documentazione di deploy di Next.js](https://nextjs.org/docs/app/building-your-application/deploying) per dettagli aggiuntivi.

## Documentazione

- [`docs/wiki/00-index.md`](docs/wiki/00-index.md) — Wiki dello Sviluppatore (architettura, modelli, servizi, API, pattern)
- [`docs/casa_nostra_schema.sql`](docs/casa_nostra_schema.sql) — schema Supabase definito e applicato
- [`docs/Casa_Nostra_Requisiti_MVP.docx`](docs/Casa_Nostra_Requisiti_MVP.docx) — requisiti funzionali completi
- [`AGENTS.md`](AGENTS.md) — convenzioni di progetto e briefing per lo sviluppo
