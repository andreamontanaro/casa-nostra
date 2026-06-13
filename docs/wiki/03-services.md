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

### Modulo Auto (`cars.ts`)
Gestisce auto, rifornimenti e letture km → `app/actions/cars.ts`:
* `createCar(_prev, formData)` & `updateCar(id, _prev, formData)`: Validano i dati tecnici dell'auto. La creazione restituisce `{ ok: true, carId }` consentendo al client di effettuare l'upload asincrono dell'immagine.
* `deleteCar(id)`: Rimuove la foto dal bucket `car-photos` e cancella l'auto dal database (innescando l'eliminazione a cascata di rifornimenti e letture contachilometri).
* `createFuelEntry(_prev, formData)` & `updateFuelEntry(id, _prev, formData)`: Gestiscono i rifornimenti salvando litri, prezzo al litro e costo totale.
* `createOdometerReading(_prev, formData)`: Registra una lettura indipendente dei chilometri per l'auto.

---

## Algoritmi Core del Dominio

I calcoli complessi del dominio del modulo auto sono isolati in funzioni pure lato server → `lib/cars.ts`.

### Calcolo Chilometraggio Attuale (`currentKm`)
Determina l'ultimo chilometraggio noto dell'auto confrontando tre sorgenti di dati → `lib/cars.ts#L34-L47`:
```typescript
export function currentKm(
  car: Pick<Car, 'initial_km'>,
  fuelEntries: Pick<FuelEntry, 'odometer_km'>[],
  odometerReadings: Pick<OdometerReading, 'km'>[],
): number
```
* **Algoritmo**: Prende come base di partenza `car.initial_km`. Itera su tutti i rifornimenti con odometro noto e su tutte le letture indipendenti dei km per trovare il valore massimo assoluto.

### Metodo Pieno-a-Pieno per Consumo Medio (`computeConsumption`)
Calcola l'efficienza dei consumi basandosi su rifornimenti consecutivi contrassegnati come "pieno" (`full_tank = true`) → `lib/cars.ts#L77-L138`.
* **Segmento di Consumo**: Intervallo tra due rifornimenti con pieno ed odometro noti.
* **Algoritmo**:
  1. Filtra i rifornimenti con odometro non nullo e li ordina in senso crescente per chilometraggio.
  2. Accumula i litri immessi e i costi sostenuti nei rifornimenti intermedi (non pieni o parziali).
  3. Quando incontra un rifornimento con `full_tank = true`:
     - Calcola la distanza percorsa: $D = Odo_{corrente} - Odo_{precedente\_pieno}$.
     - Se la distanza è maggiore di zero, calcola i litri totali consumati sommandoli: $L = \sum Litri_{intermedi} + Litri_{corrente}$.
     - Genera una metrica per il segmento: $L/100km = (L / D) * 100$; $km/L = D / L$; $Costo/Km = Spesa / D$.
     - Salva il segmento e azzera gli accumulatori.
  4. Calcola la media aggregata dividendo la somma dei litri dei segmenti per la distanza totale coperta.

### Ripartizione Chilometrica Temporale (`computeDistanceStats`)
Distribuisce la percorrenza chilometrica nel tempo per generare i dati dei grafici → `lib/cars.ts#L229-L275`.
* **Problematica**: Le letture dei km avvengono a date irregolari.
* **Algoritmo**:
  1. Ricostruisce una timeline ordinata dei km dell'auto (`buildKmTimeline`).
  2. Per ogni coppia di letture consecutive:
     - Calcola la distanza percorsa: $D = Km_{successivo} - Km_{precedente}$.
     - Calcola i giorni trascorsi: $G = Data_{successiva} - Data_{precedente}$.
     - Distribuisce la percorrenza giornaliera in parti uguali: $Km_{giornalieri} = D / G$.
     - Incrementa il valore giornaliero per ciascuno dei $G$ giorni nell'intervallo.
  3. Raggruppa i valori giornalieri in base al periodo richiesto (`day`, `week`, `month`) creando i bucket per il grafico.

### Derivazione Valori Rifornimento (`deriveFuelValue`)
Nel form di inserimento del rifornimento, l'utente interagisce con tre valori correlati: litri, prezzo al litro, e costo totale. La modifica di uno aggiorna automaticamente uno degli altri due → `lib/cars.ts#L286-L300`:
* Se viene modificato il **totale**: $Totale = Litri * PrezzoAlLitro$.
* Se vengono modificati i **litri**: $Litri = Totale / PrezzoAlLitro$.
* Se viene modificato il **prezzo al litro**: $PrezzoAlLitro = Totale / Litri$.
