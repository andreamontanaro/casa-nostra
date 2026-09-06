# Servizi e Logica Applicativa

Questa pagina descrive i servizi applicativi (Server Actions) e gli algoritmi di calcolo del dominio implementati in **Casa Nostra**.

---

## Server Actions (Mutazioni di Stato)

Tutte le mutazioni dello stato dell'applicazione sono implementate come Server Actions Next.js di tipo `'use server'`. In caso di successo o errore, restituiscono uno stato formattato o eseguono un reindirizzamento (`redirect`).

### Autenticazione (`auth.ts`)
Gestisce l'accesso e l'uscita degli utenti → `app/actions/auth.ts`:
* `login(_prev, formData)`: Invia email e password a Supabase Auth `signInWithPassword`. In caso di errore restituisce un messaggio utente; in caso di successo esegue il redirect a `/` → `app/actions/auth.ts#L10`.
* `logout()`: Chiama `signOut` sul client Supabase ed esegue il redirect alla pagina pubblica `/login` → `app/actions/auth.ts#L28`.

### Spese Condivise (`expenses.ts`)
Implementa le operazioni CRUD sulle spese condivise → `app/actions/expenses.ts`:
* `createExpense(_prev, formData)`: Valida i campi (importo, descrizione, categoria, regola di divisione, pagante, data). Se la regola è `custom`, valida che la quota dell'altra persona sia positiva e inferiore al totale. Se la spesa ha allegati (`has_attachments = '1'`), inserisce la riga nel DB e restituisce `{ ok: true, expenseId }` senza effettuare il redirect (il client caricherà i file via browser prima di navigare). Altrimenti inserisce e reindirizza alla home → `app/actions/expenses.ts#L19`.
* `updateExpense(id, _prev, formData)`: Valida e aggiorna la spesa identificata dall'id. Invalida la cache delle rotte interessate e reindirizza allo storico → `app/actions/expenses.ts#L91`.
* `deleteExpense(id)`: Recupera i percorsi di tutti gli allegati collegati alla spesa, li rimuove fisicamente dal bucket Storage `expense-attachments` e infine elimina la spesa (con cascade SQL sui metadati dell'allegato). Reindirizza allo storico → `app/actions/expenses.ts#L149`.

### Conguagli (`settlement.ts`)
* `registerSettlement(notes?, expenseIds?)`: Invoca la funzione RPC di database `register_settlement` passando note opzionali e un array opzionale di ID spese. Invalida la cache delle pagine di riepilogo, accoda la notifica Telegram del conguaglio e reindirizza alla home con un parametro di successo → `app/actions/settlement.ts`.

### Lista della Spesa (`shopping.ts`)
Le Server Action della lista sono gusci sottili sopra `lib/shopping/service.ts` → `app/actions/shopping.ts`. La logica di dominio (validazione, doppioni, spunta, controllo scontrino) sta nel modulo condiviso perché deve girare identica anche dall'assistente e dal webhook Telegram, che non hanno una sessione da cui derivare il client Supabase: per questo ogni funzione del servizio riceve il client esplicitamente.
* `addItemAction(input)`: Aggiunge un articolo. Il doppione fra gli articoli aperti lo blocca l'indice unico sul database e l'action traduce l'errore `23505` in «"Latte" è già in lista» — non c'è nessuna SELECT preventiva, che sarebbe comunque in corsa con l'altro utente. Se l'urgenza è `alta`, accoda la notifica Telegram; per le altre no, di proposito (vedi sotto).
* `updateItemAction(id, input)` / `deleteItemAction(id)` / `restoreItemAction(id)`: Modifica, elimina o rimette in lista un articolo già spuntato.
* `markBoughtAction(id)`: Spunta un articolo (`bought_via = 'app'`). Nessun dialog di conferma: non è distruttiva e si annulla dal toast.
* `clearBoughtAction()`: Svuota lo storico dei comprati. Questa sì con conferma, perché elimina davvero.
* `checkReceiptAction({ storagePath, fileName, mimeType })`: Controllo scontrino dall'app. **Il file non passa dalla Server Action**: il browser lo carica su Storage e l'action lo rilegge da lì, perché il body di una Server Action è limitato a 1 MB e la foto di uno scontrino lo supera quasi sempre (stesso motivo per cui gli allegati delle spese si caricano lato client). Il file "veicolo" viene rimosso a fine controllo: quello che resta è la copia registrata sul controllo.

**Notifiche Telegram della lista, volutamente parsimoniose.** Nel gruppo finiscono solo l'esito di un controllo scontrino e l'aggiunta di un articolo **urgente**. Notificare ogni "carta forno" trasformerebbe la chat in un rumore di fondo che si impara a ignorare — e con esso le notifiche delle spese, che invece contano.

### Telegram (`telegram.ts`)
Azioni di supporto all'integrazione con il gruppo Telegram → `app/actions/telegram.ts`:
* `linkTelegramAccount(_prev, formData)`: Collega (o scollega, con campo vuoto) l'id Telegram al profilo di chi è loggato. Valida che sia un intero positivo e traduce la violazione di unicità in un messaggio comprensibile ("già collegato all'altro profilo"). La policy `profiles_update_own` garantisce che ciascuno possa modificare solo la propria riga.
* `requestSettlementOnTelegram()`: Pubblica nel gruppo il promemoria «X ha richiesto un conguaglio» con il saldo corrente. Non scrive nulla sul database: il conguaglio vero resta un'azione dell'app, da fare dopo il bonifico. Qui l'invio è atteso (non differito) perché l'esito serve a mostrare il toast all'utente.

---

## Controllo Scontrino (`lib/shopping/service.ts`)

`runReceiptCheck()` è il cuore della funzione, condiviso dai tre punti d'ingresso (app, assistente, foto su Telegram). Riceve i byte dello scontrino già in memoria e un client Supabase esplicito, e in un giro solo:
1. Legge la lista aperta (`getOpenShoppingItems`).
2. **Una sola chiamata a Gemini** con l'immagine (o il PDF) *più* la lista con gli id: il modello trascrive le righe dei prodotti e le collega agli articoli in lista, restituendo JSON con schema fissato (`responseSchema`), come già fa `estimateChoreXp`.
3. Riverifica gli id proposti contro la lista reale — il modello propone, il server dispone — e scarta quelli che non esistono o sono ripetuti.
4. Carica il file nel bucket `shopping-receipts` e chiama la RPC `register_receipt_check`, che in un'unica transazione registra il controllo e spunta gli articoli riconosciuti. Se la RPC fallisce, il file appena caricato viene rimosso: niente orfani nel bucket.
5. Restituisce spuntati, mancanti e righe dello scontrino che non erano in lista.

### Spesa automatica dallo scontrino (`lib/shopping/receipt-expense.ts`)

Con l'opzione `createExpense` (attiva **solo sul canale Telegram**), dopo il controllo `runReceiptCheck` registra anche la spesa corrispondente allo scontrino → `createExpenseFromReceipt`. Non è un percorso con regole sue: è il form della spesa compilato in automatico con le opzioni di default dell'app.

* **Importo e data**: quelli letti sullo scontrino; se la data non è leggibile, oggi.
* **Categoria**: la propone il modello nella stessa lettura (campo `expense_category`, vincolato all'enum delle 7 categorie), con ripiego su `spesa_alimentare`.
* **Divisione**: `DEFAULT_SPLIT[categoria]` — la stessa mappa che il form propone, quindi 50/50 su affitto e viaggi, 60/40 sul resto.
* **Pagante**: chi ha mandato la foto.
* **Allegato**: la stessa immagine viene allegata alla spesa (`expense_attachments`), così si rivede dal dettaglio e l'assistente può leggerla con `get_attachments`. Se il formato non è fra quelli accettati dagli allegati (il WEBP, per esempio) l'allegato si salta e la spesa resta: è un extra, non una condizione.

Due casi in cui la spesa **non** viene creata, e il messaggio nel gruppo lo dice sempre:
* **totale illeggibile** — senza importo non c'è spesa da registrare;
* **doppione** — esiste già una spesa con lo stesso importo nella stessa data. Quasi certamente è lo stesso scontrino mandato due volte o già registrato a mano, e una spesa doppia falsa il saldo, che è l'invariante centrale dell'app. Il messaggio nomina la spesa esistente, così se davvero erano due si aggiunge dall'app.

Una spesa creata in automatico che l'utente non vede sarebbe peggio di una spesa non creata: per questo il messaggio riporta *sempre* cosa è successo, con importo, divisione, pagante, saldo aggiornato e link alla spesa per modificarla.

**Perché il riconoscimento lo fa il modello e non un confronto di stringhe**: sugli scontrini i prodotti sono abbreviati e storpiati (`LT PS PARM 1L` = latte parzialmente scremato, `POM PELATI` = pomodori pelati). Nessuna normalizzazione testuale regge il colpo, mentre il modello sta già leggendo l'immagine: chiedergli anche l'abbinamento non costa una chiamata in più.

---

### Notifiche Telegram delle mutazioni
Le action su spese e conguagli, dopo la mutazione, leggono nomi e saldo aggiornato e accodano il messaggio con `after()` di Next.js: la chiamata a Telegram avviene dopo la risposta HTTP, non rallenta il salvataggio e non può farlo fallire → `app/actions/expenses.ts`, `lib/telegram/notify.ts`. Se l'integrazione non è configurata, le funzioni escono subito senza effetti.

