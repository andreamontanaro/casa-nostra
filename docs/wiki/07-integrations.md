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

### 3bis. Uso non conversazionale: lettura della barra rapida (`readQuickItemInput`)

La barra rapida della lista della spesa ha un campo solo, e ci si scrive una riga di fretta: «scottex», «x2 mele», «2 kg di patate». I tre campi che il form chiederebbe uno per uno — nome, quantità, tipo di prodotto — li ricava il modello → `lib/shopping/service.ts`. Stessa forma della stima strutturata: una chiamata `ai.models.generateContent` senza tool e senza cronologia, con `responseMimeType: 'application/json'` e un `responseSchema` in cui `category` è vincolata con `enum` all'enum `shopping_category` del database, così il modello non può inventarsi una categoria che non esiste. Il prompt porta le stesse definizioni delle categorie che l'assistente ha nel tool `add_shopping_items`: "scottex" dev'essere cura della casa sia che lo si scriva nella barra sia che lo si dica in chat. La quantità resta testo libero come nel form («2», «2 kg», «6 bottiglie») e non viene mai inventata: se non è scritta, l'articolo non ne ha.

**Non è mai un ostacolo all'aggiunta.** Chiave assente, modello lento (c'è un `abortSignal` a 4 secondi), JSON storto, categoria fuori enum, nome restituito vuoto: ogni caso ricade sulla riga così com'è stata scritta, senza quantità e in `cibo` — la categoria più probabile in una lista della spesa e lo stesso default del form — e l'articolo entra comunque. L'esito viene detto nel toast («"mele" (2) aggiunto a 🍎 Cibo»): campi compilati da altri vanno mostrati, e correggerli è un tap sulla riga.

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

---

## Integrazione Fastweb Power Control (MyFastweb)

Fastweb non ha API pubbliche per Power Control. Il modulo Energia rifà, dal server, quello che fa la dashboard di MyFastweb nel browser → `lib/energy/fastweb.ts`. Il flusso è stato collaudato il 15 ottobre 2026 da un'anteprima Vercel (regione iad1): login senza captcha né secondo fattore.

### 1. Passi
1. `GET https://fastweb.it/myfastweb/accesso/login/` → form `formLogin` con un `securityToken` di 64 caratteri legato al cookie `PHPSESSID`.
2. `POST …/accesso/login/ajax/`, urlencoded, con i campi del form più `username` e `password` e gli header `X-Requested-With: XMLHttpRequest`, `Origin`, `Referer` → JSON `{ errorCode, errorMessage, type, needRecaptcha, mt, … }`. `errorCode` 0 è il successo; con `mt` la pagina passa da `/myfastweb/redirect/set-mt/`, e lo fa anche il client.
3. `GET …/abbonamento/consumi-power-control/` (circa 4 s) → un form per dato: `consumptionRealtime_form`, `plugStatus_form`, `consumptionMedium_form` (`period=last-seven-days`), `consumptionAppliances_form` (`action=consumptionAppliancesHome`), `loadNotify_form`, ognuno col suo token. Senza sessione Fastweb rimanda a `…/contenuti-riservati/`.
4. `POST …/consumi-power-control/ajax/`, multipart come `FormData`, con i campi di un form → `{ errorCode, data }`.

Cosa si legge di ogni `data` (forma verificata il 15/10/2026; parser in `lib/energy/readings.ts`):

| Form | Campi usati | Diventa |
| --- | --- | --- |
| `consumptionRealtime` | `realtime` (W), `realtime_max` (kW) | `realtime.watts`, `realtime.limitKw` |
| `plugStatus` | `status`: `ONLINE` / `OFFLINE` | `plugOnline` (un valore sconosciuto è `null`, niente avviso) |
| `consumptionMedium` | `totals.period[]` con `day` e `total` (Wh); `medium_o.total_consumption.selected_period` e `previous_period` (Wh) | `days`, `weekKwh`, `previousWeekKwh` |
| `consumptionAppliancesHome` | `appliances[]` con `appliance` (codice), `name_fe`, `power` (Wh sui 7 giorni) | `appliances` |
| `loadNotify` | `notifications[]` con `type`, `title`, `message`, `created_at` | `notices` (le 10 più recenti) |
| `consumptionLatest` | `latest`, un oggetto con una chiave per minuto `{ time, power: <W> }`; `max` (W) | `history.points`, `history.peakWatts` |

`consumptionLatest` (verificato il 19/10/2026) non è un form della pagina Power Control: è il grafico della pagina «Consumo in tempo reale» (`…/consumi-power-control/cruscotto/consumo-per-ore/`, la freccia nel riquadro della potenza), che chiama lo stesso `ajax/`. Il `securityToken` è uno per sessione, uguale in tutti i form delle due pagine: `fieldsFor` in `lib/energy/fastweb.ts` manda `{ securityToken, action: 'consumptionLatest' }` con il token della potenza, senza scaricare la seconda pagina. Se un giorno Fastweb desse un token per form, la serie smetterebbe di arrivare (il resto no) e andrebbe letto il form da quella pagina.

Il resto si ignora: ripartizione per apparecchio giorno per giorno (`daily_breakdown`), percentuali, posizioni e testi già formattati (`*_fe`, `perc_x`, `perc_y`), colore della potenza, e `medium_o.account_number`, il numero di contratto.

I cookie si tengono a mano (`CookieJar`: `fetch` non li conserva tra le richieste; gestisce anche le cancellazioni con `Max-Age=0` o `expires` passato) e i redirect si seguono a mano per raccogliere i cookie di ogni passaggio. Timeout di 10 s per richiesta.

### 2. Dati personali
La prima risposta della potenza contiene anche `data.realtime_sin`, con codice fiscale, email, POD e numero cliente dell'intestatario. **Non si salva e non si inoltra mai**: `lib/energy/readings.ts` legge i campi in elenco uno per uno e costruisce oggetti nuovi, senza spread di `data`. Lo stesso vale per il numero di contratto in `consumptionMedium`. I corpi delle risposte non finiscono mai nei log.

### 3. Strategia contro il captcha
Il rischio vero è far scattare il reCAPTCHA con troppi login dagli indirizzi dei data center. Per questo: la sessione si riusa tra le invocazioni (salvata cifrata in `energy_fastweb_state`), le letture recenti si riusano (10 s la potenza, un minuto la serie delle 6 ore, 30 minuti il resto), si fa al massimo un login ogni 5 minuti con un lucchetto sul database, e con `needRecaptcha` ci si ferma per 6 ore: il captcha non si aggira mai. Credenziali rifiutate: un'ora, o subito se cambiano.

### 4. Strategia di fallimento
Tutto quello che non va (rete, pagina cambiata, risposta inattesa) diventa `status: 'errore'` con l'ultima lettura salvata: la schermata la mostra attenuata, con l'ora, e riprova con attesa crescente fino a 5 minuti. Se Fastweb cambia la pagina o i nomi dei form, l'errore è in `loadPowerForms` o nei parser; la modalità diagnostica usata per scriverli (`/api/energia?forma=1`, mai in produzione: la forma delle risposte senza dati personali) è nel commit `4364c98` e si può rimettere per il tempo di una prova su un'anteprima.
