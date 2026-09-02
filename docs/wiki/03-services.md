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
* `registerSettlement(notes?, expenseIds?)`: Invoca la funzione RPC di database `register_settlement` passando note opzionali e un array opzionale di ID spese. Invalida la cache delle pagine di riepilogo e reindirizza alla home con un parametro di successo → `app/actions/settlement.ts#L7`.

