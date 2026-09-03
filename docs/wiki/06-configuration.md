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

* `GEMINI_API_KEY` → `app/api/assistant/route.ts`, `app/api/telegram/webhook/route.ts`:
  - **Tipo**: Stringa (Chiave API Google AI Studio).
  - **Scopo**: Credenziale segreta per autenticare le chiamate verso le API di Google Gemini. Serve sia alla chat dentro l'app sia all'assistente su Telegram.
* `GEMINI_MODEL` → `lib/assistant/run.ts`:
  - **Tipo**: Stringa (Codice modello).
  - **Scopo**: Identifica la versione del modello di Gemini da instanziare (es. `gemini-2.5-flash` o `gemini-1.5-flash`).
  - **Default**: Se non definita, l'applicazione utilizza come fallback `'gemini-flash-lite-latest'`.

* `SUPABASE_SERVICE_ROLE_KEY` → `lib/supabase/service.ts`:
  - **Tipo**: Stringa (JWT service role di Supabase).
  - **Scopo**: Consente al webhook Telegram — che riceve richieste dai server di Telegram, senza cookie di sessione — di leggere e scrivere sul database **bypassando RLS**. Usata esclusivamente da `createServiceClient()`; non deve mai raggiungere il browser.

### Variabili dell'Integrazione Telegram
Se `TELEGRAM_BOT_TOKEN` o `TELEGRAM_CHAT_ID` non sono impostate, l'integrazione è considerata spenta e l'app si comporta esattamente come prima (nessuna notifica, nessun webhook attivo) → `lib/telegram/config.ts`.

* `TELEGRAM_BOT_TOKEN`: token del bot rilasciato da @BotFather. Obbligatorio.
* `TELEGRAM_CHAT_ID`: id della chat di gruppo in cui il bot pubblica le notifiche (numero negativo per i gruppi). Obbligatorio.
* `TELEGRAM_WEBHOOK_SECRET`: stringa casuale condivisa con Telegram in fase di `setWebhook` e verificata sull'header `X-Telegram-Bot-Api-Secret-Token` a ogni update. Senza, il webhook risponde `500` e non elabora nulla → `app/api/telegram/webhook/route.ts`.
* `TELEGRAM_BOT_USERNAME`: username del bot senza `@`; serve a riconoscere le menzioni nel gruppo e a scartare i comandi indirizzati ad altri bot.
* `TELEGRAM_REPLY_MODE`: `mention` (default) oppure `all`. Determina quando l'assistente interviene nel gruppo.
* `NEXT_PUBLIC_SITE_URL`: URL pubblico dell'app, usato per rendere assoluti i link nei messaggi Telegram (senza, i link vengono omessi).

La procedura completa di configurazione è in `docs/telegram-setup.md`.

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
Parametri di esecuzione dell'assistente, condivisi tra la chat nell'app e il bot Telegram → `lib/assistant/run.ts`, `app/api/assistant/route.ts`:
* `MAX_TURNS = 5` → `lib/assistant/run.ts`: Numero massimo di turni interni di chiamata a funzione che l'assistente IA può risolvere in una singola richiesta HTTP prima di forzare l'uscita (previene loop infiniti di tool-calling).
* `maxDuration = 60` → `app/api/assistant/route.ts`: Timeout massimo del serverless handler (60 secondi), allineato ai limiti massimi di runtime delle funzioni Vercel/Next.js Pro.
* `runtime = 'nodejs'` → `app/api/assistant/route.ts`: Configurazione del runtime Node.js, necessaria per consentire le operazioni di I/O (conversione buffer file e download di allegati) richieste dall'SDK Gemini.

### Bot Telegram (`/api/telegram/webhook`)
Costanti che governano la memoria conversazionale del bot → `lib/telegram/conversation.ts`:
* `HISTORY_LIMIT = 20`: numero massimo di messaggi recuperati come contesto per l'assistente.
* `HISTORY_WINDOW_MINUTES = 180`: finestra temporale entro cui un messaggio è ancora considerato parte della conversazione in corso.
* `RETENTION_DAYS = 30`: oltre questa soglia le righe di `telegram_messages` vengono eliminate.
* `CHUNK_LENGTH = 3500` → `lib/telegram/format.ts`: soglia oltre la quale un messaggio viene spezzato, con margine rispetto al limite di 4096 caratteri di Telegram.
* `TIMEOUT_MS = 8000` → `lib/telegram/api.ts`: timeout delle chiamate all'API di Telegram.
