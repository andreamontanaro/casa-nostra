# Decisioni Architetturali

Questa pagina riassume le scelte tecnologiche e architetturali principali effettuate nello sviluppo di **Casa Nostra**, evidenziando i vincoli ed i tradeoff associati a ciascuna decisione.

---

## Scelta dello Stack Tecnologico

### Next.js 16 (App Router) & React 19
* **Scelta**: Utilizzo dell'ultima versione stabile di Next.js App Router → `package.json`.
* **Motivazione**: Consente l'adozione dei React Server Components (RSC) per caricare i dati direttamente dal DB senza creare API di passaggio, riducendo la latenza e azzerando i tempi di caricamento percepiti. Le Server Actions eliminano la necessità di scrivere controller API tradizionali per la gestione delle mutazioni di stato (form) e si integrano in modo ottimale con i meccanismi di caching nativi di Next.js (`revalidatePath`).

### Tailwind CSS v4 & PostCSS
* **Scelta**: Adozione della versione v4 di Tailwind → `package.json`.
* **Tradeoff**: Rende deprecato il file di configurazione legacy `tailwind.config.js` in favore della configurazione nativa all'interno del file CSS (`app/globals.css`). Questo riduce il tempo di compilazione e unifica i token di design sotto specifiche standard di variabili CSS, ma richiede una conoscenza delle nuove direttive `@theme` ed impedisce l'uso di vecchi plugin Tailwind basati su JS.

---

## Strategia di Calcolo del Saldo

### Ripartizione e Saldo Spostati sul Database (Viste SQL)
* **Scelta**: Il calcolo del saldo corrente dell'utente e la quota dovuta per ogni singola regola di divisione sono definiti in due viste SQL (`v_expense_shares` e `v_user_open_balance`) nel database Postgres → `docs/casa_nostra_schema.sql#L168-L211`.
* **Motivazione**: Evita la duplicazione della logica di calcolo del saldo (drift logico) tra il frontend (UI), i Server Component (Next.js) e l'endpoint dell'Assistente IA. Tutti e tre i canali interrogano la medesima risorsa SQL ottenendo dati identici al centesimo. Offloadare i calcoli a Postgres garantisce inoltre alte performance man mano che lo storico cresce.

### Conguaglio Transazionale (RPC Postgres)
* **Scelta**: La registrazione del conguaglio e la conseguente chiusura delle spese aperte avvengono tramite una singola chiamata RPC (`register_settlement`) definita sul DB → `docs/casa_nostra_schema.sql#L306-L394`.
* **Motivazione**: Trattandosi di un'operazione finanziaria interna alla coppia (spostamento di un saldo da aperto a saldato), non può essere eseguita tramite transazioni parziali o chiamate multiple dal client (rischio di stati orfani se una chiamata di rete cade a metà). Postgres esegue il calcolo, l'insert in `settlements` e l'update massivo in `expenses` all'interno di un'unica transazione ACID.

---

## Integrazione IA (Google Gemini Studio)

### System Instruction Context Injection (No RAG)
* **Scelta**: Il database completo delle spese e dello stato del saldo viene serializzato in formato testo e iniettato direttamente all'interno delle istruzioni di sistema inviate a Gemini ad ogni avvio di chat → `app/api/assistant/route.ts`.
* **Motivazione**: Trattandosi di un'app per due conviventi, la quantità totale dei record (qualche centinaio o migliaio di spese) rientra ampiamente all'interno della finestra di contesto del modello (1M+ token per Gemini 3.5 Flash). Questo elimina la necessità di implementare architetture RAG (Vector Search) o database vettoriali, garantendo all'assistente IA una visibilità matematica esatta e deterministica del 100% dei dati storici senza rischi di perdita di informazioni.

### Sentinelle NUL Stream per la Sincronizzazione Client/Server
* **Scelta**: Utilizzo dei caratteri di controllo speciali `\x00REFRESH\x00` e `\x00ACTION\x00` per veicolare eventi invisibili all'interno dello stream testuale dell'assistente IA → `app/api/assistant/route.ts`.
* **Motivazione**: Evita la complessità di stabilire connessioni WebSocket bidirezionali parallele o meccanismi di polling continuo. Il frontend analizza i frammenti di testo dello stream man mano che arrivano: se trova una sentinella esegue un'operazione client-side (es. mostra il loader dinamico o rinfresca la cache della pagina in background) ripulendo il buffer prima che il testo venga mostrato all'utente in chat.

---

## Sicurezza e Visibilità (Row Level Security)

### Modulo Spese (Shared)
* **Scelta**: Policy basate sulla funzione `is_authorized_user()`. Entrambi gli utenti autorizzati vedono tutte le spese, gli allegati ed i conguagli registrati nel sistema → `docs/casa_nostra_schema.sql#L218-L294`.
* **Motivazione**: L'app è pensata per la trasparenza totale sulla gestione del budget della casa tra i due conviventi.

---

## Integrazione Telegram

### Service Role sul webhook invece di una sessione applicativa
* **Contesto**: Gli update di Telegram arrivano dai server di Telegram, senza cookie: non esiste una sessione Supabase da cui derivare i permessi, e RLS bloccherebbe qualunque lettura.
* **Scelta**: Il webhook usa un client con `SUPABASE_SERVICE_ROLE_KEY`, che bypassa RLS → `lib/supabase/service.ts`.
* **Motivazione**: L'alternativa (creare sessioni applicative per il bot, o allentare le policy RLS) avrebbe indebolito il modello di sicurezza dell'app per servire un canale secondario. Il confine si sposta invece sul webhook, che accetta solo update col secret corretto, solo dalla chat configurata e solo da account Telegram collegati a un profilo: chi non è collegato non ottiene dati.

### Notifiche differite con `after()`
* **Scelta**: Le Server Action preparano il messaggio (nomi e saldo letti mentre la sessione è ancora disponibile) e ne accodano l'invio con `after()` di Next.js → `lib/telegram/notify.ts`.
* **Motivazione**: Salvare una spesa deve restare istantaneo. Una chiamata di rete a Telegram nel percorso critico aggiungerebbe latenza e, peggio, un suo fallimento rischierebbe di apparire all'utente come un errore di salvataggio. Con `after()` la notifica è best-effort e gli errori finiscono solo nei log.

### `update_id` UNIQUE come lucchetto di idempotenza
* **Contesto**: Telegram riconsegna un update se il webhook non risponde in fretta, e l'assistente può registrare spese: un doppione significherebbe una spesa scritta due volte.
* **Scelta**: Il messaggio in arrivo viene inserito in `telegram_messages` con `update_id` UNIQUE prima di qualsiasi elaborazione; se l'insert fallisce per violazione di unicità, l'update è già stato gestito e si esce → `lib/telegram/conversation.ts`.
* **Motivazione**: Il vincolo di database è l'unico punto di serializzazione affidabile in un ambiente serverless, dove non esiste stato condiviso in memoria tra invocazioni.

### Il bot risponde solo se interpellato
* **Scelta**: Nel gruppo l'assistente interviene su comandi, menzioni e risposte ai suoi messaggi; `TELEGRAM_REPLY_MODE=all` è opt-in → `app/api/telegram/webhook/route.ts`.
* **Motivazione**: Il gruppo è anche una chat fra due persone. Rispondere a tutto lo renderebbe inutilizzabile per la conversazione normale e moltiplicherebbe le chiamate a Gemini senza che nessuno le abbia chieste.

---

## Energia

### Le chiamate interne di MyFastweb, in assenza di API
* **Contesto**: Fastweb Power Control misura i consumi di casa, ma Fastweb non offre API pubbliche e il contatore non è raggiungibile in altro modo.
* **Scelta**: Il server rifà i passi della dashboard di MyFastweb con username e password (`lib/energy/fastweb.ts`), dopo una prova su un'anteprima Vercel che ha confermato il login senza captcha.
* **Motivazione**: È l'unico accesso ai dati. Il prezzo è la fragilità: se Fastweb cambia la pagina il modulo si ferma. Per questo l'integrazione è spegnibile (senza credenziali l'app è quella di prima), ogni guasto diventa uno stato leggibile in pagina, e i parser si sono scritti leggendo la forma vera delle risposte (con una modalità diagnostica temporanea, recuperabile dal commit `4364c98`) invece di indovinarla.

### Sessione su Supabase, cifrata, solo service role
* **Contesto**: Le funzioni serverless non condividono memoria: tenere la sessione solo in memoria vorrebbe dire un login a ogni istanza nuova, e più login aumentano il rischio di captcha.
* **Scelta**: Una tabella di una riga con RLS attiva e nessuna policy; cookie e token cifrati AES-256-GCM con una chiave scrypt derivata dalle credenziali (`lib/energy/crypto.ts`). La stessa riga fa da cache delle letture e da lucchetto del login.
* **Motivazione**: I cookie di una sessione aperta valgono quanto la password, e MyFastweb mostra dati personali e contrattuali. Un dump del database da solo non basta a entrarci, e non serve una variabile in più: la chiave nasce dalla password, quindi cambiarla invalida da sola la vecchia sessione.

### Polling solo a pagina aperta, nessun cron
* **Scelta**: La schermata chiede `/api/energia` ogni 15 s finché è visibile; non c'è un job che legga Fastweb in background.
* **Motivazione**: La potenza istantanea interessa mentre la si guarda. Un cron leggerebbe Fastweb giorno e notte (più login, più rischio captcha) per dati che nessuno vede. Avvisi automatici (soglia superata su Telegram) richiederebbero un cron: sono un'evoluzione possibile, non il punto di partenza.

---

## Faccende

### Vista 3D a scelta, caricata solo su richiesta
* **Contesto**: Le bottiglie in 3D (vetro, liquido come volume, rotazione col dito) richiedono WebGL e three.js, circa 150 KB compressi in più, e consumano più batteria del liquido 2D, che non ha dipendenze.
* **Scelta**: Il 2D resta la vista di serie; il 3D si sceglie con un interruttore accanto al titolo e la scelta vale per il dispositivo → `lib/chores/bottle-view.ts`. Il componente 3D si carica con `next/dynamic` (`ssr: false`) e three.js si importa solo in `lib/chores/bottles3d/` → `app/(app)/faccende/FaccendeShell.tsx`, verificato da `tests/liquid3d.test.mjs`.
* **Motivazione**: Chi non vuole il 3D non deve pagarlo: né in download, né in memoria, né in batteria. La scelta per dispositivo, come tema e accento, permette di tenerlo sul telefono nuovo e non su quello vecchio. La fisica (piano a volume costante, onde) sta in un modulo puro testabile con `node --test`, come per il 2D: la scena disegna, il livello lo decidono sempre le tacche piene.

