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
* **Scelta**: Il database completo delle spese, del garage e dello stato del saldo viene serializzato in formato testo e iniettato direttamente all'interno delle istruzioni di sistema inviate a Gemini ad ogni avvio di chat → `app/api/assistant/route.ts#L429`.
* **Motivazione**: Trattandosi di un'app per due conviventi, la quantità totale dei record (qualche centinaio o migliaio di spese) rientra ampiamente all'interno della finestra di contesto del modello (1M+ token per Gemini 3.5 Flash). Questo elimina la necessità di implementare architetture RAG (Vector Search) o database vettoriali, garantendo all'assistente IA una visibilità matematica esatta e deterministica del 100% dei dati storici senza rischi di perdita di informazioni.

### Sentinelle NUL Stream per la Sincronizzazione Client/Server
* **Scelta**: Utilizzo dei caratteri di controllo speciali `\x00REFRESH\x00` e `\x00ACTION\x00` per veicolare eventi invisibili all'interno dello stream testuale dell'assistente IA → `app/api/assistant/route.ts#L30-L40`.
* **Motivazione**: Evita la complessità di stabilire connessioni WebSocket bidirezionali parallele o meccanismi di polling continuo. Il frontend analizza i frammenti di testo dello stream man mano che arrivano: se trova una sentinella esegue un'operazione client-side (es. mostra il loader dinamico o rinfresca la cache della pagina in background) ripulendo il buffer prima che il testo venga mostrato all'utente in chat.

---

## Sicurezza e Visibilità (Row Level Security)

### Isolamento Modulo Auto (Owner-Scoped) vs Modulo Spese (Shared)
* **Scelta**: Due modelli di RLS distinti sul database:
  1. **Modulo Spese**: Policy basate sulla funzione `is_authorized_user()`. Entrambi gli utenti autorizzati vedono tutte le spese, gli allegati ed i conguagli registrati nel sistema → `docs/casa_nostra_schema.sql#L253-L274`.
  2. **Modulo Auto**: Policy basate sulla corrispondenza `owner_id = auth.uid()` o tramite clausole `EXISTS` collegate all'auto di proprietà → `docs/casa_nostra_schema.sql#L491-L501`. I dati del garage, dei consumi e delle percorrenze sono personali e totalmente invisibili all'altro partner.
* **Motivazione**: Soddisfa il requisito del modulo auto concepito come spazio privato per il tracciamento dei consumi del proprio mezzo di trasporto, mantenendo invece la trasparenza totale sulla gestione del budget della casa.
