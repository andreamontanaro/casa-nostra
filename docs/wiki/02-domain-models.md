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

### `shopping_category`
Tipo di prodotto della lista della spesa → sezione 13 dello schema: `cibo`, `bevande`, `cura_casa`, `igiene_persona`, `farmacia`, `casalinghi`, `altro`. Deliberatamente distinta da `expense_category`: là si classifica una spesa (una riga di denaro), qui un prodotto da mettere nel carrello.

### `shopping_urgency`
Quanto serve in fretta un articolo → sezione 13 dello schema: `bassa`, `media`, `alta`. **L'ordine di dichiarazione conta**: è l'ordinamento della lista (`ORDER BY urgency DESC` mette gli urgenti in cima), non serve una colonna di priorità numerica.

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
  * `works_from_home` (`boolean`, default `false`): Il partner che lavora da casa. Dal lunedì al venerdì la sua bottiglia delle faccende ha una tacca in più, e la sua prima faccenda del giorno è un bonus che non entra nel confronto → sezione 14 dello schema. Al massimo un profilo può averlo `true` (`profiles_only_one_works_from_home`, stesso indice parziale di `higher_income`).
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

### 6. Articolo della Lista della Spesa (`shopping_items`)
Una cosa che manca in casa e va comprata → sezione 13 dello schema.
* **Proprietà**:
  * `id` (`uuid`, PK).
  * `name` (`text`): Nome del prodotto (non vuoto).
  * `category` (`shopping_category`, default `altro`).
  * `quantity` (`text`, Nullable): Quantità in **testo libero** ("2 confezioni", "1 kg", "una bottiglia grande"). Al supermercato si ragiona così, non con un numero più un'unità di misura: un campo numerico costringerebbe a scegliere un'unità che spesso non esiste.
  * `urgency` (`shopping_urgency`, default `media`).
  * `note` (`text`, Nullable).
  * `bought_at` / `bought_by` / `bought_via` (Nullable): Stato dell'acquisto. `bought_via` è uno tra `app`, `assistente`, `scontrino`.
  * `receipt_check_id` (`uuid`, Nullable, `ON DELETE SET NULL`) e `receipt_line` (`text`, Nullable): Quale controllo scontrino ha spuntato l'articolo e con quale riga dello scontrino.
  * `added_by` (`uuid`), `created_at`, `updated_at`.
* **Stato aperto/comprato**: `bought_at IS NULL` => ancora da comprare; valorizzato => comprato (storico). È lo stesso pattern di `expenses.settlement_id`.
* **Invarianti**:
  * `shopping_items_bought_consistency`: o ci sono tutti e tre i dati dell'acquisto (`bought_at`, `bought_by`, `bought_via`) o nessuno. Niente stati a metà.
  * `shopping_items_receipt_consistency`: `receipt_check_id` valorizzato solo se `bought_via = 'scontrino'`.
  * `shopping_items_unique_open_name`: indice unico **parziale** su `lower(trim(name))` per i soli articoli aperti. "Latte" non può stare due volte tra le cose da comprare, ma lo storico può contenerlo quante volte serve. La Server Action traduce la violazione (`23505`) in «"Latte" è già in lista».
* **RLS come le spese, non come le faccende**: la lista è di casa, non di chi ha scritto la riga — entrambi aggiungono, spuntano ed eliminano qualsiasi articolo.

### 7. Controllo Scontrino (`shopping_receipt_checks`)
Uno scontrino letto e confrontato con la lista → sezione 13 dello schema.
* **Proprietà**:
  * `id` (`uuid`, PK).
  * `storage_path` (`text`, UNIQUE), `file_name`, `mime_type`, `size_bytes`: Il file nel bucket privato `shopping-receipts` (formato del percorso: `YYYY/MM/uuid.ext`).
  * `source` (`text`): `app` (caricato dalla lista), `telegram` (foto nel gruppo), `spesa` (allegato già presente su una spesa).
  * `store_name`, `receipt_date`, `receipt_total` (Nullable): Quello che si è riusciti a leggere dallo scontrino.
  * `lines` (`jsonb`): Righe lette (`[{"name", "quantity", "price"}]`), conservate per poter rileggere un controllo senza riaprire l'immagine.
  * `matched_count` (`int`): Quanti articoli ha spuntato.
  * `checked_by` (`uuid`), `checked_at` (`timestamptz`).
* **Sopravvive agli articoli che spunta**: gli articoli si possono eliminare, il controllo no — è il riferimento temporale di "dall'ultimo scontrino". Per lo stesso motivo il file sta in un bucket suo e non in `expense-attachments`: cancellare una spesa non deve portarsi via la prova di un controllo (quando lo scontrino arriva da una spesa, se ne salva una copia).

### 8. Faccenda fatta (`chore_entries`)
Una riga = una tacca nella bottiglia di chi ha fatto la faccenda → sezione 14 dello schema, `docs/migrations/2026-09-30_faccende.sql`. Sostituisce il vecchio modulo "Gestione casa" (catalogo, XP, kudos), eliminato con `2026-09-08_remove_gestione_casa.sql`.
* **Proprietà**:
  * `id` (`uuid`, PK).
  * `name` (`text`, 1–40 caratteri): testo libero e corto, perché sta scritto dentro la tacca. Non esiste un catalogo: i suggerimenti dell'app sono i nomi già usati.
  * `done_by` (`uuid`): chi l'ha fatta.
  * `done_on` (`date`, default `chore_today()`): il giorno nel fuso `Europe/Rome`. Retrodatabile, mai nel futuro.
  * `created_by` (`uuid`): chi l'ha segnata. Può differire da `done_by`: si può segnare per l'altro.
  * `created_at` (`timestamptz`): ordina le tacche dentro lo stesso giorno.
* **Tutte le faccende valgono uguale**: non c'è peso, area o durata. Conta solo quante.
* **Bottiglia piena = limite vero**: il trigger `trg_chore_entries_check_bottle` rifiuta la tacca oltre la capienza (5, più `chore_bonus()` per chi lavora da casa nei giorni feriali) con l'errore `chore_bottle_full`, e una data futura con `chore_future_date`. Un lock consultivo per persona e giorno serializza due inserimenti contemporanei.
* **RLS**: entrambi leggono tutto e possono inserire per chiunque (ma `created_by = auth.uid()`); si elimina solo una riga propria (`done_by` o `created_by` uguale a `auth.uid()`). Niente `UPDATE`: per correggere si elimina e si rifà.
* **Un debito c'è, ed è voluto** (al contrario del vecchio modulo): chi resta indietro se lo porta ai giorni successivi, senza limite. Il calcolo è la vista `v_chore_balance` → [05. Accesso ai Dati](05-data-access.md). Nessun legame con i soldi e nessuna notifica.

### 9. Azione delle faccende (`chore_presets`)
Un'azione da toccare nel pannello "Ho fatto una faccenda" → `docs/migrations/2026-09-30_faccende_azioni.sql`, sezione 14 dello schema. **Non esistono azioni predefinite**: il codice definisce solo i sette ambiti (`CHORE_PRESET_GROUPS` in `lib/chores/presets.ts`), e le azioni le creano i due utenti man mano.
* **Proprietà**: `id`, `name` (1–40 caratteri, come `chore_entries.name`), `group_id` (uno degli ambiti di `CHORE_PRESET_GROUPS`: `cucina`, `pulizie`, `bagno`, `bucato`, `rifiuti`, `spesa`, `manutenzione`, con un `CHECK`), `created_by`, `created_at`.
* **Solo una scorciatoia**: toccarla segna una faccenda con quel nome; `chore_entries` non ha un riferimento all'azione, quindi eliminarla non tocca le faccende già segnate.
* **Niente doppioni**: indice unico su `lower(trim(name))` (errore `23505`), tradotto dal servizio in «c'è già tra le azioni».
* **RLS di casa**, come la lista: entrambi le vedono, le aggiungono e le eliminano.

### 10. Nome tolto dai recenti (`chore_recent_dismissals`)
Un nome nascosto dalla scheda "Recenti" del pannello → `docs/migrations/2026-09-30_faccende_recenti.sql`, sezione 14 dello schema.
* **Proprietà**: `name_key` (PK, `recentKey(name)`: il nome senza spazi in più e in minuscolo), `dismissed_by`, `dismissed_at`.
* **Nasconde, non cancella**: le faccende con quel nome restano in `chore_entries`, e con loro bottiglie e arretrato. Il nome torna tra i recenti appena viene segnata una faccenda con quel nome **dopo** `dismissed_at` (`recentChoreNames` in `lib/chores/presets.ts`). Togliere di nuovo lo stesso nome aggiorna solo l'ora (upsert).
* **RLS di casa**: entrambi tolgono e rimettono.

