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

### `chore_area`
Area di casa a cui appartiene una faccenda (modulo "Gestione casa") → sezione 11 dello schema: `cucina`, `bagno`, `pulizie`, `spazzatura`, `bucato`, `spesa`, `manutenzione`, `altro`. Raggruppa le voci in UI e alimenta i titoli per varietà (fase 3, non ancora implementata).

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

### 8. Catalogo Faccende (`chore_templates`)
Voci del modulo "Gestione casa" (faccende domestiche ricorrenti) → sezione 11 dello schema. Interamente modificabile dai due utenti: il seed iniziale (21 voci, `docs/design-modulo-gestione-casa.md § 5`) è solo il contenuto di partenza della tabella, non una costante di codice.
* **Proprietà**:
  * `id` (`uuid`, PK).
  * `name` (`text`): Nome della faccenda (non vuoto).
  * `area` (`chore_area`).
  * `effort_xp` (`int`, 1–100): Valore in XP, tarato sui minuti di lavoro.
  * `cadence_days` (`int`, Nullable): Ogni quanti giorni la casa se l'aspetta. `NULL` = **gesto**: registrabile ma mai atteso, non compare nella lista "Da fare" e non ha uno stato di ritardo (es. "Preparare il pranzo all'altro", che altrimenti diventerebbe un rimprovero automatizzato).
  * `active` (`boolean`, default `true`): Eliminazione logica. Una voce disattivata sparisce da liste e conti futuri, lo storico resta intatto.
  * `sort_order` (`int`).
* **Cancellazione**: fisica solo se la voce non ha mai avuto log (rimedia a un errore di battitura); altrimenti si disattiva, mai si elimina.

### 9. Registro Faccende (`chore_logs`)
Un completamento registrato → sezione 11 dello schema.
* **Proprietà**:
  * `id` (`uuid`, PK).
  * `template_id` (`uuid`, Nullable, `ON DELETE SET NULL`): `NULL` per una faccenda fuori catalogo (una-tantum) o se la voce di catalogo è stata cancellata fisicamente.
  * `title`, `area`, `xp`: **snapshot** del catalogo al momento della registrazione — ritarare `chore_templates` non riscrive lo storico (stessa logica di `custom_other_share` sulle spese).
  * `done_by` (`uuid`): chi ha fatto la faccenda.
  * `done_at` (`timestamptz`, default now): retrodatabile.
  * `created_by` (`uuid`): chi ha registrato la riga. Può differire da `done_by`: registrare per conto dell'altro è permesso.
  * `note` (`text`, Nullable).
* **Nessun saldo, nessun conguaglio.** A differenza delle spese, il modulo non modella un debito: non esiste una vista di saldo delle faccende né una RPC di pareggio. È una scelta di design, non un'omissione — vedi `docs/design-modulo-gestione-casa.md § 3` (principio "nessun debito di faccende").
* **RLS più restrittiva del modulo spese**: si corregge o cancella solo una riga propria (`done_by` o `created_by` uguale a `auth.uid()`). Le spese permettono a entrambi di modificare qualsiasi riga; qui no, perché una riga di `chore_logs` dice "questa cosa l'ho fatta io" e poter cancellare il contributo dell'altro con un tap non deve essere possibile.
* **Eliminazione permanente, non solo "annulla"**: dal feed "Fatto di recente" di `/casa` ogni riga propria è cancellabile in ogni momento (icona cestino + `Dialog` di conferma, stesso pattern usato per l'eliminazione di una spesa), non solo nei secondi subito dopo la registrazione tramite il toast "Annulla". Stessa Server Action (`undoChoreLog`) per entrambi i percorsi.

### 10. Kudos (`chore_kudos`, fase 2)
Reazione di un utente su una faccenda completata dall'altro → sezione 11 dello schema (migrazione fase 2).
* **Proprietà**: `log_id` + `from_user_id` (PK composita — al massimo un kudos per utente per log: cambiare emoji aggiorna la riga, non la duplica), `emoji` (default `❤️`), `created_at`.
* **Divieto di auto-kudos imposto da RLS**, non da un controllo client: la `WITH CHECK` della policy di insert/update confronta `from_user_id` con `done_by` del log referenziato via sottoquery.
* **Gli XP dei kudos non sono attribuiti a nessuno dei due utenti.** Contano nel totale settimanale che alimenta l'obiettivo di casa (`KUDOS_XP` in `lib/chores/config.ts`, sommato via `v_chore_kudos_week`), ma **non** entrano nella barra di equilibrio, che si basa solo su `chore_logs.xp` per utente (`v_chore_week`). È la stessa distinzione concettuale del design: il kudos premia l'attenzione reciproca, non è un modo indiretto di accumulare punti personali.
