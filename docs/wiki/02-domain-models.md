# Modelli di Dominio e Database

Questa pagina definisce le entità di dominio di **Casa Nostra**, i vincoli di business codificati a livello di schema SQL e le convenzioni per i tipi TypeScript.

---

## Tipi di Enumerazione (Enums)

### `expense_category`
Rappresenta le categorie per le spese del modulo condiviso → `docs/casa_nostra_schema.sql#L15-L23`:
* `affitto`: Spese d'affitto (associa per default la suddivisione `fifty_fifty`).
* `bolletta`: Utenze domestiche (luce, gas, acqua, internet).
* `spesa_alimentare`: Acquisti nei supermercati.
* `abbonamento`: Servizi ricorsivi (Netflix, Spotify, ecc.).
* `manutenzione`: Lavori in casa.
* `viaggi`: Vacanze e spostamenti condivisi.
* `altro`: Qualsiasi spesa non classificata.

### `split_rule`
Regola di suddivisione dell'importo → `docs/casa_nostra_schema.sql#L25-L30`:
* `fifty_fifty`: Ripartizione esatta 50/50.
* `sixty_forty`: Ripartizione 60/40. Il partner con il reddito maggiore paga il 60% dell'importo.
* `custom`: Suddivisione personalizzata, espressa con quota fissa a carico del partner.

### `fuel_type`
Tipologie di carburante supportate per il modulo auto → `docs/casa_nostra_schema.sql#L424-L428`:
* `benzina`, `diesel`, `gpl`, `metano`, `elettrico`, `ibrido`.

---

## Schema delle Entità

### 1. Profilo Utente (`profiles`)
Rappresenta uno dei due conviventi. Estende la tabella nativa `auth.users` di Supabase → `docs/casa_nostra_schema.sql#L36-L42`.
* **Vincolo di Dominio**: Lo schema prevede **esattamente due righe** in questa tabella → `docs/casa_nostra_schema.sql#L44-L45`.
* **Proprietà**:
  * `id` (`uuid`, PK): Collegato a `auth.users(id)` con eliminazione a cascata.
  * `display_name` (`text`): Nome visualizzato dell'utente (non vuoto).
  * `higher_income` (`boolean`): Identifica il partner con reddito superiore.
* **Invariante**: Al massimo **un solo utente** può avere `higher_income = true` → `docs/casa_nostra_schema.sql#L50-L53`.

### 2. Spesa (`expenses`)
Rappresenta una transazione condivisa di acquisto → `docs/casa_nostra_schema.sql#L82-L101`.
* **Proprietà**:
  * `id` (`uuid`, PK): Identificativo autogenerato.
  * `amount` (`numeric(10,2)`): Importo totale in euro (CHECK > 0).
  * `description` (`text`): Descrizione (non vuota).
  * `category` (`expense_category`): Categoria spesa.
  * `split_rule` (`split_rule`): Regola di divisione.
  * `custom_other_share` (`numeric(10,2)`, Nullable): Quota a carico dell'altra persona. Obbligatoria se `split_rule` è `custom`, altrimenti deve essere nulla → `docs/casa_nostra_schema.sql#L91-L94`.
  * `paid_by` (`uuid`): Riferimento a `profiles(id)` dell'utente che ha anticipato il denaro.
  * `expense_date` (`date`): Data della spesa (default: oggi).
  * `settlement_id` (`uuid`, Nullable): Identificativo del conguaglio associato. Se valorizzato, la spesa è **saldata**; se nullo, la spesa è **aperta** e partecipa al saldo corrente → `docs/casa_nostra_schema.sql#L103-L104`.
* **Invarianti**:
  * `custom_other_share` deve essere positivo e minore dell'importo totale della spesa (quest'ultimo controllo è delegato a livello applicativo in `createExpense` → `app/actions/expenses.ts#L52`).

### 3. Conguaglio (`settlements`)
Rappresenta il trasferimento di denaro (bonifico) che salda un gruppo di spese aperte → `docs/casa_nostra_schema.sql#L60-L70`.
* **Proprietà**:
  * `id` (`uuid`, PK): Identificativo autogenerato.
  * `settled_at` (`timestamptz`): Timestamp dell'esecuzione (default: adesso).
  * `amount` (`numeric(10,2)`): Totale conguagliato (CHECK > 0).
  * `from_user_id` (`uuid`): Chi effettua il bonifico (deve soldi).
  * `to_user_id` (`uuid`): Chi riceve il bonifico (ha anticipato denaro).
  * `notes` (`text`, Nullable): Note del bonifico.
* **Invariante**: `from_user_id` e `to_user_id` devono essere differenti → `docs/casa_nostra_schema.sql#L69`.

### 4. Allegato Spesa (`expense_attachments`)
Associa i metadati di scontrini o ricevute PDF/immagini ad una spesa → `docs/casa_nostra_schema.sql#L124-L133`.
* **Proprietà**:
  * `id` (`uuid`, PK): Autogenerato.
  * `expense_id` (`uuid`): Spesa associata (ref `expenses(id)` ON DELETE CASCADE).
  * `storage_path` (`text`): Chiave univoca del file nel bucket storage (formato: `expense_id/UUID.estensione`) → `docs/casa_nostra_schema.sql#L121-L122`.
  * `file_name` (`text`): Nome originale del file.
  * `mime_type` (`text`): Tipo MIME (es. `image/jpeg`, `application/pdf`).
  * `size_bytes` (`bigint`): Dimensione file in byte (CHECK > 0).
  * `uploaded_by` (`uuid`): Riferimento al caricatore.

### 5. Auto (`cars`)
Rappresenta un veicolo di proprietà esclusiva di uno dei due partner → `docs/casa_nostra_schema.sql#L430-L441`.
* **Proprietà**:
  * `owner_id` (`uuid`): Riferimento a `profiles(id)` del proprietario dell'auto.
  * `model` (`text`): Modello del veicolo (es. "Ford Fiesta").
  * `year` (`integer`): Anno di immatricolazione (CHECK 1900-2100).
  * `fuel_type` (`fuel_type`): Alimentazione dell'auto.
  * `tank_capacity` (`numeric(6,2)`, Nullable): Capienza serbatoio in litri (CHECK > 0).
  * `initial_km` (`integer`): Chilometri iniziali dell'auto al momento dell'inserimento nell'app.

### 6. Rifornimento Carburante (`fuel_entries`)
Registrazione di una spesa di carburante → `docs/casa_nostra_schema.sql#L446-L459`.
* **Proprietà**:
  * `car_id` (`uuid`): Ref `cars(id)` ON DELETE CASCADE.
  * `entry_date` (`date`): Data rifornimento.
  * `liters` (`numeric(7,3)`): Litri inseriti (CHECK > 0).
  * `price_per_liter` (`numeric(6,3)`): Costo al litro (CHECK > 0).
  * `total_cost` (`numeric(8,2)`): Costo totale speso (CHECK > 0).
  * `odometer_km` (`integer`, Nullable): Lettura contachilometri al momento del rifornimento.
  * `full_tank` (`boolean`): Specifica se è stato effettuato un pieno (default: true).

### 7. Lettura Contachilometri (`odometer_readings`)
Lettura indipendente dei km dell'auto (per statistiche di percorrenza senza rifornimento) → `docs/casa_nostra_schema.sql#L464-L472`.
* **Proprietà**:
  * `car_id` (`uuid`): Ref `cars(id)` ON DELETE CASCADE.
  * `reading_date` (`date`): Data lettura contachilometri.
  * `km` (`integer`): Chilometri registrati (CHECK >= 0).
