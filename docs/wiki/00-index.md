# Casa Nostra - Developer Wiki

Benvenuto nella wiki per sviluppatori di **Casa Nostra**, un'applicazione web mobile-first progettata per la gestione delle spese domestiche condivise di una coppia convivente e per il tracciamento delle spese personali delle auto.

La wiki è ottimizzata per l'uso da parte di agenti LLM e sviluppatori umani. Fornisce dettagli su architettura, modelli di dati, logica di business e configurazioni senza dover analizzare l'intero codice sorgente.

---

## Panoramica del Progetto

**Casa Nostra** è un'applicazione web basata su Next.js App Router, Tailwind CSS e Supabase (Postgres + Auth + Storage) → `package.json`.
L'applicazione gestisce due moduli principali completamente indipendenti a livello di visibilità e regole di dominio:

1. **Modulo Spese Condivise**: Riservato a esattamente due utenti conviventi. Tutte le spese registrate in questo modulo sono condivise per definizione. Il saldo netto viene calcolato centralmente sul database tramite viste SQL e conguagliato in un'unica transazione tramite una funzione RPC. L'inserimento delle spese prevede due regole di suddivisione predefinite (50/50 per l'affitto, 60/40 per tutte le altre categorie basate sul reddito) e una suddivisione personalizzata.
2. **Modulo Auto ("Le mie auto")**: Modulo personale in cui ciascun utente gestisce in modo privato e isolato le proprie autovetture, i rifornimenti di carburante (metodo pieno-a-pieno) e le letture contachilometri. La riservatezza dei dati è garantita a livello di database tramite Row Level Security (RLS) di Supabase.

In entrambi i moduli è integrato un **Assistente IA** multimodale basato sul modello Google Gemini che permette di inserire dati a linguaggio naturale, analizzare scontrini e consultare lo storico.

---

## Indice della Wiki

Seleziona una sezione per approfondire i dettagli tecnici:

* **[01. Architettura](01-architecture.md)**: Struttura delle directory, routing Next.js App Router, middleware di autenticazione (`proxy.ts`) e flusso delle dipendenze.
* **[02. Modelli di Dominio](02-domain-models.md)**: Schema del database, entità di dominio (Profiles, Expenses, Settlements, Attachments, Cars, Fuel Entries, Odometer Readings) e vincoli di integrità.
* **[03. Servizi e Logica Applicativa](03-services.md)**: Server Actions per le mutazioni e calcoli del dominio (calcolo consumi pieno-a-pieno, ripartizione chilometrica).
* **[04. Superficie delle API](04-api-surface.md)**: Route handler dell'Assistente IA (`/api/assistant`), dichiarazioni dei tool di Gemini, prompt e streaming payload.
* **[05. Accesso ai Dati](05-data-access.md)**: Integrazione client Supabase (Browser/Server), query e viste SQL di calcolo saldo (`v_user_open_balance`), funzioni transazionali Postgres.
* **[06. Configurazione ed Environment](06-configuration.md)**: Variabili d'ambiente, configurazioni locali e limiti applicativi (dimensioni file, MIME accettati).
* **[07. Integrazioni Esterne](07-integrations.md)**: Servizi di terze parti (Supabase Auth/Database/Storage, Google Gemini API via `@google/genai`).
* **[08. Design System e Pattern di UI](08-patterns.md)**: Implementazione di Material Design 3, Tailwind CSS v4, Safe Area mobile e pattern interattivi (optimistic UI, transizioni di pagina).
* **[09. Decisioni Architetturali](09-decisions.md)**: Logica e motivazioni dietro alle scelte tecnologiche ed architetturali principali (Next.js 16, RLS, calcolo saldo sul DB, ecc.).
