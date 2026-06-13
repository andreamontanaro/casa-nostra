# Superficie delle API (Assistente Chat)

Questa pagina descrive l'endpoint pubblico dell'Assistente IA di **Casa Nostra**, i suoi contratti di richiesta/risposta, la logica di streaming e le firme dei tool multimodali.

---

## Endpoint `/api/assistant`

L'applicazione espone un singolo Route Handler Next.js per la chat con l'assistente IA. L'endpoint esegue logica di orchestrazione con Gemini ed esegue query o mutazioni di stato sul database tramite tool calling.

* **Route**: `/api/assistant` → `app/api/assistant/route.ts`
* **Metodo**: `POST`
* **Runtime**: Node.js (`export const runtime = 'nodejs'`) → `app/api/assistant/route.ts#L24`
* **Durata massima esecuzione**: 60 secondi (`export const maxDuration = 60`) → `app/api/assistant/route.ts#L25`

### Protezione ed Autenticazione
1. **Controllo Chiave API**: Se la variabile d'ambiente `GEMINI_API_KEY` non è configurata sul server, l'API risponde con stato `503 Service Unavailable` → `app/api/assistant/route.ts#L208-L214`.
2. **Autenticazione Utente**: Esegue una chiamata a `getCurrentUser()` → `app/api/assistant/route.ts#L216`. Se non è presente una sessione Supabase attiva nei cookie della richiesta, risponde con stato `401 Unauthorized` → `app/api/assistant/route.ts#L218`.

---

## Modelli di Richiesta e Risposta

### Payload di Richiesta (JSON)
L'endpoint riceve un oggetto JSON contenente la cronologia della conversazione e l'area funzionale in cui si trova l'utente:
```json
{
  "messages": [
    { "role": "user", "text": "Aggiungi spesa di 12€ per la cena" },
    { "role": "model", "text": "Riepilogo la spesa... Confermi?" },
    { "role": "user", "text": "Sì, conferma." }
  ],
  "context": "expenses"
}
```
* `messages`: Array di messaggi con ruoli alternati (`user` / `model`) contenenti il testo della chat.
* `context`: Filtro di contesto (`expenses` o `auto`) per agganciare le istruzioni di sistema e i tool corretti.

### Payload di Risposta (Streaming)
L'endpoint risponde con uno stream di testo in tempo reale (`ReadableStream`) con header `Content-Type: text/plain; charset=utf-8` → `app/api/assistant/route.ts#L417-L423`.
Oltre al testo normale generato dal modello, lo stream può includere marcatori speciali (sentinelle) formati dal carattere nullo `\x00` per comunicare stati operativi al frontend senza sporcare la chat visiva:

1. **Sentinella di Aggiornamento della Pagina (`REFRESH_SENTINEL`)**
   * **Valore**: `\x00REFRESH\x00` → `app/api/assistant/route.ts#L34`
   * **Scopo**: Inviato al client quando una Server Action invocata dall'IA (creazione spesa/rifornimento) va a buon fine. Il frontend intercetta la sentinella e rinfresca la cache di Next.js in background.
2. **Sentinella dell'Azione Corrente (`ACTION_OPEN`/`ACTION_CLOSE`)**
   * **Valore**: Delimitato da `\x00ACTION\x00` e `\x00/ACTION\x00` → `app/api/assistant/route.ts#L39-L40`
   * **Scopo**: Racchiude una frase che descrive l'operazione in corso (es. `\x00ACTION\x00Sto caricando lo scontrino...\x00/ACTION\x00`). Il client la estrae dal flusso e la mostra come loader testuale.

---

## Istruzioni di Sistema (System Instructions)

La system instruction viene compilata dinamicamente prima di interrogare Gemini, iniettando lo stato corrente dell'applicazione:

* **Contesto Spese (`expenses`)** → `app/api/assistant/route.ts#L429`:
  - Elenco dei profili utenti autorizzati (display name e ID) con indicazione del reddito superiore.
  - Saldo netto complessivo corrente ricavato dalla vista SQL (`v_user_open_balance`).
  - La data odierna in formato ISO (es. `2026-06-13`).
  - L'elenco completo delle spese registrate con i relativi ID, date, importi, categorie, regole di suddivisione e l'indicazione visiva se contengono un allegato (`📎scontrino`).
* **Contesto Auto (`auto`)** → `app/api/assistant/route.ts#L670`:
  - Elenco delle auto nel garage con id, modello, carburante, km attuali e consumo medio storico.
  - I dettagli degli ultimi 10 rifornimenti inseriti.

---

## Firma dei Tool (Function Calling)

L'assistente è configurato per utilizzare il modello `Gemini 3.5 Flash` (o `gemini-flash-lite-latest` da configurazione) e supporta i seguenti strumenti:

### 1. Inserimento Spese (`create_expense`)
Dichiara a Gemini come inserire una spesa condivisa nel database → `app/api/assistant/route.ts#L83-L131`.
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

### 2. Lettura Allegato Spesa (`get_attachments`)
Consente a Gemini di visionare e analizzare il file di uno scontrino → `app/api/assistant/route.ts#L61-L79`.
* **Flusso**:
  1. Gemini invoca `get_attachments` passando l'UUID della spesa.
  2. Il backend recupera i metadati dell'allegato e genera un URL firmato temporaneo di Supabase Storage → `app/api/assistant/route.ts#L533-L540`.
  3. Scarica i byte dell'allegato in memoria dal bucket privato e li converte in formato Base64.
  4. Restituisce i dati multimodali a Gemini come parte di tipo `inlineData` contenente il buffer e il tipo MIME del file → `app/api/assistant/route.ts#L551`.

### 3. Inserimento Rifornimento (`create_fuel_entry`)
Dichiara i parametri per registrare una spesa di carburante → `app/api/assistant/route.ts#L133-L180`.
* **Logica**: Il modello deve ricevere almeno due parametri numerici tra litri, prezzo/litro e costo totale. Prima di chiamare il tool, il modello calcola internamente il terzo parametro mancante → `app/api/assistant/route.ts#L753-L763`.

### 4. Aggiornamento Contachilometri (`update_odometer`)
* **Parametri**: `car_id` (UUID auto) e `km` (intero positivo) → `app/api/assistant/route.ts#L181-L205`.
