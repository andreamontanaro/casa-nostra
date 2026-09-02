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
L'applicazione integra un bucket privato di Supabase Storage:

* **Bucket `expense-attachments`** → `lib/attachments.ts#L3`:
  - **Uso**: Conserva immagini e PDF delle ricevute/scontrini.
  - **Pathing**: `expense_id/{uuid}.ext` → `lib/attachments.ts#L58-L61`.
  - **Accesso**: I file sono privati. Per la visualizzazione nel client o per l'assistente, viene generato un URL firmato temporaneo (1 ora) sul server → `lib/queries.ts#L76-L81`.

---

## Integrazione Google Gemini (SDK `@google/genai`)

L'assistente virtuale è integrato utilizzando l'SDK ufficiale di Google GenAI `→ \`package.json\``.

### 1. Inizializzazione Client
Il client viene istanziato ad ogni richiesta `POST` nel Route Handler API usando la classe `GoogleGenAI` → `app/api/assistant/route.ts#L249`:
```typescript
const ai = new GoogleGenAI({ apiKey })
```

### 2. Modello di Esecuzione Streaming
La generazione del testo dell'assistente avviene in tempo reale utilizzando il metodo `ai.models.generateContentStream` → `app/api/assistant/route.ts#L278`. I chunk di testo generati dal modello vengono decodificati e scritti direttamente nel buffer di risposta HTTP.

### 3. Gestione Input Multimodale (Visione Ricevute)
Quando l'utente richiede di "guardare" un allegato, l'assistente utilizza il tool `get_attachments`. Il Route Handler esegue un'integrazione a cascata → `app/api/assistant/route.ts#L524-L569`:
1. Chiama `getExpenseAttachments(expenseId)` per ottenere gli URL firmati temporanei delle ricevute da Supabase Storage.
2. Esegue una chiamata `fetch` per scaricare i byte del file in memoria sul server.
3. Converte il file scaricato in una stringa Base64.
4. Passa a Gemini un oggetto `Part` contenente i dati del file allineando il tipo MIME (`image/jpeg`, `image/png`, `application/pdf`) all'interno dell'array `inlineData` del payload di chat → `app/api/assistant/route.ts#L551`.

### 4. Strategia di Gestione dei Fallimenti (Failure Strategy)
* **Gestione degli errori nei Tool**: Se un'operazione del database fallisce durante l'esecuzione di un tool chiamatosi da Gemini (es. dati non validi nell'inserimento spesa), l'endpoint intercetta l'errore e restituisce un payload di risposta di errore per la funzione (es. `{ error: "Messaggio di errore" }`) → `app/api/assistant/route.ts#L351`. In questo modo, Gemini riceve il feedback dal database e formula una spiegazione in italiano per l'utente nello stream.
* **Fallback Globale di Timeout o Rete**: Tutta la logica di streaming dell'assistente è racchiusa in un blocco `try-catch` globale → `app/api/assistant/route.ts#L274,L406`. Se si verifica un timeout delle API Gemini o un errore di connessione, lo stream invia un messaggio di avviso finale predefinito (`"⚠️ Si è verificato un errore con l'assistente. Riprova tra poco."`) e chiude la connessione in modo pulito prevenendo crash del server.
