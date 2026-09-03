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
  onExpenseCreated // notifica che una spesa è stata davvero registrata
})
```

Il Route Handler dell'app traduce le callback nelle sentinelle dello stream; il webhook Telegram accumula il testo e lo pubblica come singolo messaggio. `MAX_TURNS = 5` limita i cicli interni di tool calling.

---

## Istruzioni di Sistema (System Instructions)

La system instruction viene compilata dinamicamente prima di interrogare Gemini, iniettando lo stato corrente dell'applicazione → `lib/assistant/instructions.ts`:

* **Contesto Spese**:
  - Elenco dei profili utenti autorizzati (display name e ID) con indicazione del reddito superiore.
  - Saldo netto complessivo corrente ricavato dalla vista SQL (`v_user_open_balance`).
  - La data odierna in formato ISO (es. `2026-06-13`).
  - L'elenco completo delle spese registrate con i relativi ID, date, importi, categorie, regole di suddivisione e l'indicazione visiva se contengono un allegato (`📎scontrino`).

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
4. Comandi diretti (`/id`, `/aiuto`, `/saldo`, `/conguaglio`) rispondono senza interpellare Gemini.
5. Altrimenti: `sendChatAction('typing')`, ricostruzione della cronologia, `runAssistant({ channel: 'telegram' })`, conversione Markdown → HTML e invio nel gruppo.

### Payload di risposta
Sempre `200` con `{"ok": true}` quando l'update è accettato (elaborato o volutamente ignorato): a Telegram interessa solo che la consegna sia andata a buon fine. Gli esiti per l'utente arrivano come messaggi nella chat, non nel corpo della risposta.
