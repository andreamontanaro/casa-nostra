# Configurazione ed Environment

Questa pagina documenta le variabili d'ambiente necessarie all'applicazione, le impostazioni dei bucket e le costanti configurate per la gestione dei limiti applicativi.

---

## Variabili d'Ambiente (Environment Variables)

Le variabili d'ambiente dell'applicazione sono configurate nel file di ambiente locale `.env.local` → `.env.local`.

### Variabili Client-Side (Prefisso `NEXT_PUBLIC_`)
Queste variabili sono incluse nel bundle JavaScript client-side e sono accessibili sia nel browser che sul server.

* `NEXT_PUBLIC_SUPABASE_URL` → `lib/supabase/browser.ts#L6`:
  - **Tipo**: Stringa (URL).
  - **Scopo**: L'endpoint API del progetto Supabase per le chiamate REST, GraphQL e Storage.
* `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `lib/supabase/browser.ts#L7`:
  - **Tipo**: Stringa (JWT).
  - **Scopo**: La chiave API pubblica "Anon" di Supabase. Viene inviata negli header delle richieste HTTP per attivare la Row Level Security (RLS) sul database.

### Variabili Server-Side (Segrete)
Queste variabili non hanno il prefisso `NEXT_PUBLIC_`, sono mantenute esclusivamente sul server Node.js e non vengono mai esposte al browser.

* `GEMINI_API_KEY` → `app/api/assistant/route.ts#L208`:
  - **Tipo**: Stringa (Chiave API Google AI Studio).
  - **Scopo**: Credenziale segreta per autenticare le chiamate verso le API di Google Gemini.
* `GEMINI_MODEL` → `app/api/assistant/route.ts#L27`:
  - **Tipo**: Stringa (Codice modello).
  - **Scopo**: Identifica la versione del modello di Gemini da instanziare (es. `gemini-2.5-flash` o `gemini-1.5-flash`).
  - **Default**: Se non definita, l'applicazione utilizza come fallback `'gemini-flash-lite-latest'`.

---

## Limiti Applicativi e Costanti di Configurazione

I limiti sui file caricabili e sul funzionamento dell'assistente IA sono definiti a livello di codice nelle costanti dei rispettivi moduli.

### Allegati Spese (`expense_attachments`)
Limiti configurati per il caricamento di scontrini e ricevute delle spese condivise → `lib/attachments.ts`:
* `ATTACHMENTS_BUCKET = 'expense-attachments'`: Nome del bucket di storage privato → `lib/attachments.ts#L3`.
* `MAX_FILES = 5`: Numero massimo di allegati associabili a una singola spesa → `lib/attachments.ts#L5`.
* `MAX_SIZE_BYTES = 10 * 1024 * 1024` (10 MB): Dimensione massima consentita per ciascun file → `lib/attachments.ts#L6`.
* `ACCEPTED_MIME = ['image/jpeg', 'image/png', 'application/pdf']`: Formati file accettati (JPG, PNG e file PDF) → `lib/attachments.ts#L8-L12`.

### Assistente IA Chat (`/api/assistant`)
Parametri di esecuzione del Route Handler serverless dell'assistente chat → `app/api/assistant/route.ts`:
* `MAX_TURNS = 5` → `app/api/assistant/route.ts#L28`: Numero massimo di turni interni di chiamata a funzione che l'assistente IA può risolvere in una singola richiesta HTTP prima di forzare l'uscita (previene loop infiniti di tool-calling).
* `maxDuration = 60` → `app/api/assistant/route.ts#L25`: Timeout massimo del serverless handler (60 secondi), allineato ai limiti massimi di runtime delle funzioni Vercel/Next.js Pro.
* `runtime = 'nodejs'` → `app/api/assistant/route.ts#L24`: Configurazione del runtime Node.js, necessaria per consentire le operazioni di I/O (conversione buffer file e download di allegati) richieste dall'SDK Gemini.
