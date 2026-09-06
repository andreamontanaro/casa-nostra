# Superficie delle API (Assistente Chat e Bot Telegram)

Questa pagina descrive i due Route Handler di **Casa Nostra**: l'endpoint dell'Assistente IA usato dalla chat nell'app e il webhook del bot Telegram. Entrambi si appoggiano allo stesso motore condiviso → `lib/assistant/run.ts`.

---

## Endpoint `/api/assistant`

L'applicazione espone un singolo Route Handler Next.js per la chat con l'assistente IA. L'endpoint esegue logica di orchestrazione con Gemini ed esegue query o mutazioni di stato sul database tramite tool calling.

* **Route**: `/api/assistant` → `app/api/assistant/route.ts` (guscio sottile sopra `runAssistant`)
* **Metodo**: `POST`
* **Runtime**: Node.js (`export const runtime = 'nodejs'`)
* **Durata massima esecuzione**: 60 secondi (`export const maxDuration = 60`)

### Protezione ed Autenticazione
1. **Controllo Chiave API**: Se la variabile d'ambiente `GEMINI_API_KEY` non è configurata sul server, l'API risponde con stato `503 Service Unavailable`.
2. **Autenticazione Utente**: Esegue una chiamata a `getCurrentUser()`. Se non è presente una sessione Supabase attiva nei cookie della richiesta, risponde con stato `401 Unauthorized`.

---

## Modelli di Richiesta e Risposta

### Payload di Richiesta (JSON)
L'endpoint riceve un oggetto JSON contenente la cronologia della conversazione:
```json
{
  "messages": [
    { "role": "user", "text": "Aggiungi spesa di 12€ per la cena" },
    { "role": "model", "text": "Riepilogo la spesa... Confermi?" },
    { "role": "user", "text": "Sì, conferma." }
  ]
}
```
* `messages`: Array di messaggi con ruoli alternati (`user` / `model`) contenenti il testo della chat.

### Payload di Risposta (Streaming)
L'endpoint risponde con uno stream di testo in tempo reale (`ReadableStream`) con header `Content-Type: text/plain; charset=utf-8`.
Oltre al testo normale generato dal modello, lo stream può includere marcatori speciali (sentinelle) formati dal carattere nullo `\x00` per comunicare stati operativi al frontend senza sporcare la chat visiva:

1. **Sentinella di Aggiornamento della Pagina (`REFRESH_SENTINEL`)**
   * **Valore**: `\x00REFRESH\x00`
   * **Scopo**: Inviato al client quando una Server Action invocata dall'IA (creazione spesa) va a buon fine. Il frontend intercetta la sentinella e rinfresca la cache di Next.js in background.
2. **Sentinella dell'Azione Corrente (`ACTION_OPEN`/`ACTION_CLOSE`)**
   * **Valore**: Delimitato da `\x00ACTION\x00` e `\x00/ACTION\x00`
   * **Scopo**: Racchiude una frase che descrive l'operazione in corso (es. `\x00ACTION\x00Sto caricando lo scontrino...\x00/ACTION\x00`). Il client la estrae dal flusso e la mostra come loader testuale.

---

## Motore Condiviso (`runAssistant`)

La logica di conversazione non vive nel Route Handler ma in `lib/assistant/run.ts`, così può servire due canali diversi:

```typescript
runAssistant({
  messages,        // cronologia della conversazione
  userId,          // profilo per conto del quale l'assistente agisce
  db,              // client Supabase esplicito (il webhook passa quello service role)
  channel,         // 'app' | 'telegram': cambia le istruzioni di formato
  apiKey,
  onText,          // testo del modello, man mano che arriva
  onAction,        // frase di stato prima dell'esecuzione di uno strumento
  onExpenseCreated, // notifica che una spesa è stata davvero registrata
  onShoppingChanged // notifica che la lista della spesa è cambiata
})
```

Il Route Handler dell'app traduce le callback nelle sentinelle dello stream; il webhook Telegram accumula il testo e lo pubblica come singolo messaggio. `MAX_TURNS = 5` limita i cicli interni di tool calling.

---

## Istruzioni di Sistema (System Instructions)

La system instruction viene compilata dinamicamente prima di interrogare Gemini, iniettando lo stato corrente dell'applicazione → `lib/assistant/instructions.ts`:

* **Contesto Spese e Lista**:
  - Elenco dei profili utenti autorizzati (display name e ID) con indicazione del reddito superiore.
  - Saldo netto complessivo corrente ricavato dalla vista SQL (`v_user_open_balance`).
  - La data odierna in formato ISO (es. `2026-06-13`).
  - L'elenco completo delle spese registrate con i relativi ID, date, importi, categorie, regole di suddivisione e l'indicazione visiva se contengono un allegato (`📎scontrino`).
  - La **lista della spesa** aperta con gli ID di ogni articolo, tipo di prodotto, quantità e urgenza: così «cosa manca?» si risponde dal contesto, senza chiamare nessuno strumento, e spuntare un articolo non richiede prima di cercarlo.
  - Data e negozio dell'**ultimo controllo scontrino** e la lista di ciò che non è stato comprato con quello scontrino (dalla vista `v_shopping_missing_since_last_check`).

  Le query della lista sono avvolte in un `catch` che degrada a valore vuoto: se il modulo non è ancora migrato sul database, il contesto perde una sezione e l'assistente delle spese continua a funzionare.

---

## Firma dei Tool (Function Calling)

L'assistente è configurato per utilizzare il modello `Gemini 3.5 Flash` (o `gemini-flash-lite-latest` da configurazione) e supporta i seguenti strumenti:

### 1. Inserimento Spese (`create_expense`)
Dichiara a Gemini come inserire una spesa condivisa nel database → `lib/assistant/tools.ts`.
* **Regola**: Il modello deve riepilogare la spesa e attendere una conferma esplicita dell'utente prima di effettuare la chiamata a funzione.
* **Parametri**:
  * `amount` (`number`, Obbligatorio): Importo positivo.
  * `description` (`string`, Obbligatorio): Descrizione della spesa.
  * `category` (`string`, Obbligatorio): Una delle 7 categorie ammesse.
  * `paid_by` (`string`, Obbligatorio): L'UUID esatto dell'utente pagatore.
  * `split_rule` (`string`, Opzionale): default calcolato in base alla categoria.
  * `custom_other_share` (`number`, Condizionale): Quota dell'altro utente se split rule è custom.
  * `expense_date` (`string`, Opzionale): Data in formato `YYYY-MM-DD`.
  * `action` (`string`, Obbligatorio): Descrizione testuale dell'azione (es. "Sto aggiungendo la bolletta...").

Alla creazione, oltre all'inserimento, il tool accoda la notifica nel gruppo Telegram: una spesa registrata dall'assistente è un movimento come gli altri → `lib/assistant/run.ts`.

### 2. Lettura Allegato Spesa (`get_attachments`)
Consente a Gemini di visionare e analizzare il file di uno scontrino → `lib/assistant/tools.ts`.
* **Flusso**:
  1. Gemini invoca `get_attachments` passando l'UUID della spesa.
  2. Il backend recupera i metadati dell'allegato e genera un URL firmato temporaneo di Supabase Storage.
  3. Scarica i byte dell'allegato in memoria dal bucket privato e li converte in formato Base64.
  4. Restituisce i dati multimodali a Gemini come parte di tipo `inlineData` contenente il buffer e il tipo MIME del file.

---

### 3. Lista della spesa (`add_shopping_items`, `mark_shopping_bought`, `remove_shopping_items`)
Strumenti di scrittura sulla lista → `lib/assistant/tools.ts`. A differenza dei tool delle spese, **non riscrivono la logica di dominio**: chiamano `lib/shopping/service.ts`, lo stesso modulo delle Server Action.
* `add_shopping_items({ items: [{ name, category, quantity?, urgency?, note? }] })`: Aggiunge più prodotti in una chiamata sola. **Senza giro di conferma**, a differenza di `create_expense`: aggiungere alla lista non muove soldi e si annulla con un tap, la conferma sarebbe solo un ostacolo fra «serve il latte» e il latte in lista. I doppioni non fanno fallire il resto: vengono riportati e basta.
* `mark_shopping_bought({ item_ids })`: Spunta gli articoli comprati (`bought_via = 'assistente'`).
* `remove_shopping_items({ item_ids })`: Toglie articoli **senza** segnarli comprati. Questo sì con conferma esplicita: elimina.

### 4. Controllo scontrino di una spesa (`check_expense_receipt`)
Confronta con la lista lo scontrino allegato a una spesa (`📎scontrino`), spunta ciò che risulta comprato e riporta cosa resta → `lib/assistant/run.ts`. Scarica l'allegato da `expense-attachments` e passa i byte a `runReceiptCheck`, che ne salva una copia nel bucket dei controlli.

Le tre operazioni di scrittura sulla lista, quando vanno a buon fine, invocano `onShoppingChanged`: nel Route Handler dell'app diventa la stessa `REFRESH_SENTINEL` usata per le spese, così la pagina sotto la chat si aggiorna.

---

## Endpoint `/api/telegram/webhook`

Riceve gli aggiornamenti del bot Telegram: notifiche in uscita a parte, è il punto d'ingresso dell'assistente nel gruppo dei due conviventi.

* **Route**: `/api/telegram/webhook` → `app/api/telegram/webhook/route.ts`
* **Metodo**: `POST` (chiamato dai server di Telegram, non dal browser)
* **Runtime**: Node.js — `maxDuration = 60`
* **Esclusione dall'autenticazione**: `proxy.ts` lascia passare `/api/telegram/*` senza il redirect degli utenti non autenticati.

### Protezione
1. **Secret dell'update**: si confronta l'header `X-Telegram-Bot-Api-Secret-Token` con `TELEGRAM_WEBHOOK_SECRET`; se non combacia la risposta è `403`, se il secret non è configurato è `500` (meglio muto che aperto).
2. **Chat ammesse**: solo il gruppo di `TELEGRAM_CHAT_ID` e le chat private con il bot.
3. **Identità**: l'assistente agisce per conto del profilo con `telegram_user_id` corrispondente al mittente. Un account non collegato riceve solo le istruzioni per collegarsi.

### Ciclo di elaborazione
1. Verifica secret, chat e condizioni di intervento (comando, menzione, risposta al bot, chat privata, oppure sempre con `TELEGRAM_REPLY_MODE=all`).
2. Risponde subito `200 {"ok":true}` e prosegue in `after()`: Gemini può impiegare decine di secondi e Telegram ripeterebbe l'update.
3. `claimUpdate` inserisce il messaggio in `telegram_messages` — l'`update_id` UNIQUE fa da lucchetto contro i doppioni.
4. Comandi diretti (`/id`, `/aiuto`, `/saldo`, `/conguaglio`, `/lista`, `/scontrino`) rispondono senza interpellare Gemini.
5. Altrimenti: `sendChatAction('typing')`, ricostruzione della cronologia, `runAssistant({ channel: 'telegram' })`, conversione Markdown → HTML e invio nel gruppo.

### Scontrini inviati in chat
Il webhook accetta anche foto e documenti (immagini o PDF), non solo testo:
* La **didascalia** di una foto vale quanto il testo, quindi decide come sempre `shouldReply`: nel gruppo serve una menzione, un comando o una risposta al bot (in chat privata basta la foto; con `TELEGRAM_REPLY_MODE=all` basta la foto anche nel gruppo). È la scelta che tiene il bot silenzioso davanti a una foto qualsiasi nel gruppo.
* `/scontrino` **in risposta** a una foto già inviata la ripesca da `reply_to_message`: è la strada per controllare uno scontrino mandato prima.
* Delle più risoluzioni in cui Telegram consegna una foto si prende sempre la più grande: su uno scontrino la differenza fra leggere `LT PS 1L` e non leggere niente è tutta lì.
* Il file si scarica con `downloadTelegramFile` (`getFile` + endpoint dei file) e finisce in `runReceiptCheck` con `source = 'telegram'`. La risposta nel gruppo elenca spuntati e mancanti; **nessuna notifica separata**, sarebbe la stessa cosa detta due volte nella stessa chat.

### Payload di risposta
Sempre `200` con `{"ok": true}` quando l'update è accettato (elaborato o volutamente ignorato): a Telegram interessa solo che la consegna sia andata a buon fine. Gli esiti per l'utente arrivano come messaggi nella chat, non nel corpo della risposta.
