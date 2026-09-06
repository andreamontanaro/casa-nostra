# Integrazioni Esterne

Questa pagina descrive le integrazioni con servizi e API esterne utilizzate da **Casa Nostra**: il fornitore Backend-as-a-Service (Supabase) e il fornitore di Intelligenza Artificiale (Google Gemini).

---

## Integrazione Supabase

L'intera persistenza, l'autenticazione degli utenti e la gestione dei file binari sono delegate a Supabase.

### 1. Autenticazione (Auth)
* **Meccanismo**: Supabase Auth gestisce le identità degli utenti. Non c'è registrazione pubblica; i due utenti sono pre-registrati dall'amministratore sul pannello di Supabase → `AGENTS.md#L42-L44`.
* **Sessione**: La sessione viene mantenuta tramite cookie protetti (`JWT`) scambiati tra client e server Next.js. Il middleware `proxy.ts` gestisce il refresh silente della sessione a ogni richiesta controllando `auth.getUser()` → `proxy.ts#L26`.

### 2. Database (PostgreSQL)
* **Comunicazione**: Avviene tramite il client `@supabase/supabase-js` instanziato tramite helper server/client → `lib/supabase/server.ts`.
* **Sicurezza (RLS)**: Row Level Security è abilitata su tutte le tabelle. La funzione SQL `is_authorized_user()` verifica che l'UUID di `auth.uid()` esista in `public.profiles` prima di consentire le letture/scritture → `docs/casa_nostra_schema.sql#L226-L234`.

### 3. File Storage (Buckets)
L'applicazione integra due bucket privati di Supabase Storage:

* **Bucket `expense-attachments`** → `lib/attachments.ts#L3`:
  - **Uso**: Conserva immagini e PDF delle ricevute/scontrini allegati a una spesa.
  - **Pathing**: `expense_id/{uuid}.ext` → `lib/attachments.ts#L58-L61`.
  - **Accesso**: I file sono privati. Per la visualizzazione nel client o per l'assistente, viene generato un URL firmato temporaneo (1 ora) sul server → `lib/queries.ts#L76-L81`.
* **Bucket `shopping-receipts`** → `lib/shopping/receipts.ts`:
  - **Uso**: Conserva la foto (o il PDF) di ogni scontrino confrontato con la lista della spesa.
  - **Pathing**: `YYYY/MM/{uuid}.ext`.
  - **Perché separato**: il controllo scontrino sopravvive alla spesa. Quando lo scontrino arriva da un allegato di una spesa (`source = 'spesa'`) se ne salva una copia qui, così eliminare la spesa non cancella la prova del controllo.

---

## Integrazione Google Gemini (SDK `@google/genai`)

L'assistente virtuale è integrato utilizzando l'SDK ufficiale di Google GenAI `→ \`package.json\``.

### 1. Inizializzazione Client
Il client viene istanziato a ogni esecuzione dell'assistente usando la classe `GoogleGenAI` → `lib/assistant/run.ts`:
```typescript
const ai = new GoogleGenAI({ apiKey })
```

### 2. Modello di Esecuzione Streaming
La generazione del testo avviene con il metodo `ai.models.generateContentStream` → `lib/assistant/run.ts`. I chunk vengono consegnati al chiamante tramite la callback `onText`: la chat dell'app li scrive direttamente nel buffer di risposta HTTP, il bot Telegram li accumula e pubblica un unico messaggio nel gruppo.

### 3. Gestione Input Multimodale (Visione Ricevute)
Quando l'utente richiede di "guardare" un allegato, l'assistente utilizza il tool `get_attachments`. Il motore esegue un'integrazione a cascata → `lib/assistant/run.ts`:
1. Chiama `getExpenseAttachments(expenseId)` per ottenere gli URL firmati temporanei delle ricevute da Supabase Storage.
2. Esegue una chiamata `fetch` per scaricare i byte del file in memoria sul server.
3. Converte il file scaricato in una stringa Base64.
4. Passa a Gemini un oggetto `Part` contenente i dati del file allineando il tipo MIME (`image/jpeg`, `image/png`, `application/pdf`) all'interno dell'array `inlineData` del payload di chat → `lib/assistant/run.ts`.

### 3bis. Uso non conversazionale: stima strutturata (`estimateChoreXp`)

Non ogni chiamata a Gemini passa da `runAssistant`. `estimateChoreXp` → `app/actions/chores.ts` stima area e XP di una faccenda "fuori catalogo" a partire dal solo testo libero: una singola chiamata `ai.models.generateContent` (non streaming, senza tool, senza cronologia), con `config.responseMimeType: 'application/json'` e `responseSchema` (via `Type` dell'SDK) per forzare l'output a `{ area, xp }` invece di prosa da fare il parsing. Il prompt include il catalogo attivo (`chore_templates` con `active = true`) come riferimento di taratura ("XP ≈ minuti di lavoro", stessa regola di `docs/design-modulo-gestione-casa.md` § "Catalogo iniziale"), così la stima resta coerente con i valori già scelti invece che su una scala arbitraria. La risposta è sempre e solo un suggerimento pre-compilato nel form (`components/chores/RegisterChoreSheet.tsx`), mai scritta sul database direttamente: l'utente la vede e può correggerla prima di salvare.

### 4. Strategia di Gestione dei Fallimenti (Failure Strategy)
* **Gestione degli errori nei Tool**: Se un'operazione del database fallisce durante l'esecuzione di un tool chiamatosi da Gemini (es. dati non validi nell'inserimento spesa), il motore intercetta l'errore e restituisce un payload di risposta di errore per la funzione (es. `{ error: "Messaggio di errore" }`) → `lib/assistant/run.ts`. In questo modo, Gemini riceve il feedback dal database e formula una spiegazione in italiano per l'utente nello stream.
* **Fallback Globale di Timeout o Rete**: I chiamanti racchiudono l'esecuzione dell'assistente in un `try-catch` → `app/api/assistant/route.ts`, `app/api/telegram/webhook/route.ts`. In caso di timeout delle API Gemini o errore di connessione, la chat dell'app invia nello stream un avviso finale predefinito (`"⚠️ Si è verificato un errore con l'assistente. Riprova tra poco."`) e chiude la connessione in modo pulito, mentre il bot pubblica un messaggio di scuse nel gruppo.

---

## Integrazione Telegram (Bot API)

Il bot Telegram è insieme un canale di **notifica** (l'app scrive nel gruppo dei due conviventi) e un canale di **conversazione** (i due interrogano l'assistente IA dal gruppo). La procedura di configurazione completa è in `docs/telegram-setup.md`; l'integrazione è opzionale e resta spenta se mancano le variabili d'ambiente → `lib/telegram/config.ts`.

### 1. Notifiche in uscita
Le Server Action che modificano lo stato compongono un messaggio HTML e ne accodano l'invio con `after()` di Next.js, così la chiamata a Telegram avviene **dopo** la risposta HTTP e non rallenta (né può far fallire) il salvataggio → `lib/telegram/notify.ts`.

* Spesa creata / modificata / eliminata → `app/actions/expenses.ts`
* Conguaglio registrato → `app/actions/settlement.ts`
* Richiesta di conguaglio (solo promemoria, nessuna scrittura sul DB) → `app/actions/telegram.ts`
* Spesa creata dall'assistente → `lib/assistant/run.ts`

Ogni notifica include il saldo aggiornato, letto da `v_user_open_balance` e mai ricalcolato a mano → `lib/balance.ts`.

### 2. Webhook in ingresso
* **Route**: `/api/telegram/webhook` → `app/api/telegram/webhook/route.ts` (`POST`, runtime Node, `maxDuration = 60`).
* **Esclusione dall'autenticazione**: gli update arrivano dai server di Telegram senza cookie di sessione, quindi `proxy.ts` lascia passare `/api/telegram/*` senza redirect → `proxy.ts`.
* **Autenticità**: unico controllo possibile è l'header `X-Telegram-Bot-Api-Secret-Token`, confrontato con `TELEGRAM_WEBHOOK_SECRET`. Senza secret configurato il webhook risponde `500`.
* **Accesso ai dati**: senza sessione utente si usa il client service role, che bypassa RLS → `lib/supabase/service.ts`. L'autorizzazione applicativa è il collegamento `profiles.telegram_user_id`: chi non è collegato non ottiene nulla se non le istruzioni per collegarsi.
* **Idempotenza**: `update_id` è UNIQUE su `telegram_messages`; l'insert del messaggio in arrivo fa da lucchetto contro le riconsegne di Telegram → `lib/telegram/conversation.ts`.
* **Risposta immediata**: si risponde `200` subito e si elabora il messaggio in `after()`, perché Gemini può impiegare decine di secondi e Telegram ripeterebbe l'update.

### 3. Quando il bot interviene
Nel gruppo il bot risponde solo se il messaggio è un comando, contiene una menzione al bot o è una risposta a un suo messaggio; in chat privata risponde sempre. Con `TELEGRAM_REPLY_MODE=all` risponde a ogni messaggio del gruppo → `app/api/telegram/webhook/route.ts`.

Comandi gestiti senza passare da Gemini: `/id`, `/aiuto`, `/saldo`, `/conguaglio`. Tutto il resto (compresi `/recap` e `/spesa`) diventa un prompt per l'assistente.

**Bootstrap**: `TELEGRAM_CHAT_ID` si scopre con `/id`, ma quel comando è nel webhook — che senza la variabile non saprebbe quale chat riconoscere. Per rompere il cerchio, finché la variabile è vuota il webhook risponde in qualsiasi chat, ma esclusivamente a `/id`, senza accedere al database: restituisce l'id della chat e quello del mittente, due valori che chi scrive già possiede. Impostata la variabile, il filtro sulle chat torna pieno. In alternativa `npm run telegram:setup -- chats` legge gli stessi id da `getUpdates`, senza che l'app sia online.

### 4. Memoria conversazionale
Il webhook è stateless, quindi la cronologia vive nella tabella `telegram_messages`: gli ultimi 20 messaggi delle ultime 3 ore vengono ricostruiti come turni per Gemini, con i messaggi utente prefissati dal nome di chi ha scritto (`[Andrea] ho pagato io`) perché nel gruppo scrivono in due → `lib/telegram/conversation.ts`.

### 5. Formattazione dei messaggi
Gemini risponde in Markdown, Telegram accetta solo un sottoinsieme di HTML: la conversione (grassetto, corsivo, codice, link, elenchi) e lo split dei messaggi oltre i 4096 caratteri sono in `lib/telegram/format.ts`. Se Telegram rifiuta l'HTML, il messaggio viene rispedito in chiaro invece di andare perso → `lib/telegram/api.ts`.
