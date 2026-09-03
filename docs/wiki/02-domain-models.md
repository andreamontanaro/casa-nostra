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

---

## Schema delle Entità

### 1. Profilo Utente (`profiles`)
Rappresenta uno dei due conviventi. Estende la tabella nativa `auth.users` di Supabase → `docs/casa_nostra_schema.sql#L36-L42`.
* **Vincolo di Dominio**: Lo schema prevede **esattamente due righe** in questa tabella → `docs/casa_nostra_schema.sql#L44-L45`.
* **Proprietà**:
  * `id` (`uuid`, PK): Collegato a `auth.users(id)` con eliminazione a cascata.
  * `display_name` (`text`): Nome visualizzato dell'utente (non vuoto).
  * `higher_income` (`boolean`): Identifica il partner con reddito superiore.
  * `telegram_user_id` (`bigint`, UNIQUE, nullable): Id dell'account Telegram collegato al profilo. È ciò che permette al bot di riconoscere chi scrive nel gruppo; `NULL` significa account non collegato → sezione 10 dello schema.
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

### 5. Messaggio Telegram (`telegram_messages`)
Memoria conversazionale del bot Telegram → sezione 10 dello schema. Il webhook è stateless, quindi la cronologia necessaria all'assistente per i dialoghi a più turni (es. la conferma prima di registrare una spesa) è persistita qui. Non è un'entità di dominio: è stato di supporto all'integrazione.
* **Proprietà**:
  * `id` (`bigint`, PK, identity).
  * `chat_id` (`bigint`): Chat Telegram di provenienza.
  * `update_id` (`bigint`, UNIQUE, nullable): `update_id` dell'aggiornamento in arrivo. L'unicità rende idempotenti le riconsegne di Telegram; è `NULL` sulle risposte del bot.
  * `role` (`text`): `user` oppure `model`, come i turni di Gemini.
  * `sender_name` (`text`, nullable): Nome di chi ha scritto, necessario nel gruppo per capire chi dice "io".
  * `content` (`text`): Testo del messaggio.
  * `created_at` (`timestamptz`).
* **Ritenzione**: Le righe più vecchie di 30 giorni vengono eliminate dal webhook → `lib/telegram/conversation.ts`.
