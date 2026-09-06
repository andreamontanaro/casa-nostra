<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — Casa Nostra

Questo file ti serve da briefing prima di scrivere codice. Prima di avviare modifiche, fai sempre riferimento alla **Wiki dello Sviluppatore** in `docs/wiki/00-index.md` per una comprensione completa del sistema senza leggere il codice sorgente.

I documenti di riferimento e le guide del progetto sono:
- `docs/Casa_Nostra_Requisiti_MVP.docx` — requisiti funzionali completi
- `docs/casa_nostra_schema.sql` — schema Supabase definito e applicato
- `docs/wiki/00-index.md` — Wiki dello Sviluppatore (Architettura, Modelli, Servizi, API, Accesso Dati, Pattern)
- `docs/telegram-setup.md` — guida alla configurazione del bot Telegram (notifiche, assistente nel gruppo, scontrini inviati in chat)

Leggili prima di iniziare. Questo file riassume le cose più importanti e aggiunge convenzioni tecniche e raccomandazioni pratiche.

## Cosa stiamo costruendo

Casa Nostra è un'app web mobile-first per due persone conviventi che vogliono gestire le spese di casa in modo trasparente. L'idea è semplice: ogni spesa inserita nell'app è, per definizione, condivisa. Esistono due sole regole di divisione: 50/50 per l'affitto, e 60/40 per tutto il resto (dove il partner con reddito maggiore paga il 60%). L'app mostra in ogni momento chi deve quanto all'altro — il "saldo" — e permette di chiudere tutto con un "conguaglio" quando uno dei due bonifica all'altro la differenza.

È pensata esclusivamente per due utenti fissi. Non serve un sistema di registrazione pubblico: i due account vengono creati manualmente in Supabase prima del primo avvio.

## Stack tecnico

Il progetto è inizializzato con lo stack seguente (verificato nel `package.json` → `package.json`):
- **Next.js** 16.2.4 (App Router, compiler Turbopack)
- **React** 19.2.4
- **Tailwind CSS** v4.0.0 (configurazione via CSS in `app/globals.css` tramite `@theme`)
- **Supabase** (Postgres + Auth + Storage via `@supabase/ssr` 0.10.2 e `@supabase/supabase-js` 2.103.3)
- **Google Gemini SDK** (`@google/genai` 2.7.0) per l'assistente IA chat
- **TypeScript** abilitato

## Regole di dominio (le più importanti)

Le regole di business sono già codificate nel database, ma l'app deve rispettarle coerentemente anche lato client.

**Default della regola di divisione all'inserimento.** Quando l'utente sceglie la categoria `affitto`, il default proposto è `fifty_fifty`; per ogni altra categoria il default è `sixty_forty`. Il default deve sempre essere modificabile dall'utente prima del salvataggio.

**Calcolo del saldo.** Non calcolarlo lato client sommando le spese a mano. Esiste già la vista `v_user_open_balance` che fa tutto: per ogni utente restituisce `total_anticipated`, `total_owed` e `net_position`. Il saldo da mostrare in home è semplicemente il valore assoluto di uno dei due `net_position`, con l'indicazione di chi deve a chi (chi ha `net_position` positivo è in credito, l'altro gli deve soldi).

**Conguaglio.** Non scrivere logica transazionale custom. Esiste la funzione RPC `register_settlement(p_notes text)` che in un'unica transazione crea la riga in `settlements` e marca tutte le spese aperte come saldate. Chiamala con `supabase.rpc('register_settlement', { p_notes: ... })`. Solleva un'eccezione se il saldo è zero, quindi gestisci quel caso a monte disabilitando il bottone.

**Spesa aperta vs saldata.** Una spesa è "aperta" quando `settlement_id IS NULL`, "saldata" altrimenti. Solo le aperte entrano nel saldo corrente. Le saldate restano nello storico, visibili ma con stato distinto.

**Validazioni.** Lo schema ha già i check constraints giusti (importo > 0, descrizione non vuota, `from_user_id <> to_user_id`, ecc.) e ha RLS attivo su tutte le tabelle. Non duplicare questi vincoli lato client come se fossero la sicurezza — però fai comunque validazione lato form per dare una UX decente: feedback immediato, niente submit che falliscono al round-trip.

## Autenticazione

Gestita interamente da Supabase Auth. I due utenti sono creati manualmente dal pannello Supabase e i rispettivi record in `public.profiles` sono inseriti a mano (vedi sezione 9 dello schema SQL). Non devi implementare signup né reset password — solo login.

L'integrazione usa il pacchetto `@supabase/ssr`. I client sono in `lib/supabase/` (browser e server). Il middleware di refresh sessione e reindirizzamento degli utenti non autenticati è implementato in `proxy.ts` (Next.js 16 sostituisce `middleware.ts` con `proxy.ts`).

## Architettura ed Organizzazione

L'architettura del progetto è documentata dettagliatamente in `docs/wiki/01-architecture.md`. 

L'applicazione segue la struttura standard di Next.js App Router:
- **Routing**: `/login` (pubblica), `/landing` (pubblica), `/` (privata), `/spese` (storico privata), `/conguaglio` (conguaglio privata).
- **Mutazioni**: Implementate tramite Server Actions in `app/actions/`.
- **Query**: Caricate nei Server Component tramite funzioni di utility in `lib/queries.ts` e `lib/queries-cars.ts`.
- **Interattività**: Isolata nei Client Component (es. `HomeShell.tsx`, `ExpenseForm.tsx`).

## Stile grafico e UI

L'app è mobile-first, comoda con una sola mano, e segue le linee guida di **Material Design 3** con una palette tonale basata su un colore di base verde-azzurro ("denaro"). Per tutti i dettagli su implementazione e costanti grafiche, vedi `docs/wiki/08-patterns.md`.

Alcune linee guida concrete:

**Tipografia.** Usa il system font stack (`ui-sans-serif, system-ui, -apple-system, ...`) così su iOS diventa San Francisco e su Android Roboto. Tailwind lo fa già di default con `font-sans`.

**Touch target.** Minimo 44px (linea guida iOS) / 48dp (Android). Con Tailwind, `h-11` è il minimo ragionevole per bottoni e row tappabili.

**Safe area.** iOS ha notch e home indicator, Android ha la gesture bar. Usa `env(safe-area-inset-*)` per la bottom navigation, il FAB e l'header. In Tailwind: classi come `pb-[env(safe-area-inset-bottom)]`.

**Colori.** Un solo accent (un verde o un blu-teal funzionano bene per un'app di "casa e soldi") e per il resto neutri. Supporto dark mode via `dark:` di Tailwind basato su `prefers-color-scheme`: il documento lo richiede esplicitamente.

**Componenti.** Ti consiglio di valutare [shadcn/ui](https://ui.shadcn.com) — componenti copia-incolla basati su Radix e Tailwind, accessibili e stilabili. Si sposano bene con il look neutro descritto sopra. Non è un obbligo: Tailwind puro va benissimo. Questa è una raccomandazione mia.

**Feedback.** Ogni salvataggio, eliminazione o conguaglio deve dare feedback visivo immediato (toast, cambio stato del bottone, loading). Le azioni distruttive — eliminazione di una spesa e conferma di un conguaglio — richiedono sempre una seconda conferma tramite dialog. Questo è nei requisiti.

**Lingua e formati.** Tutta l'UI in italiano. Importi in euro con due decimali e separatore virgola: `Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })`. Date in formato italiano con `Intl.DateTimeFormat('it-IT')`. Non serve un sistema di i18n complesso — stringhe inline o un semplice modulo di costanti bastano.

**Input importo.** Su mobile usa `inputMode="decimal"` sull'input dell'importo per far apparire la tastiera numerica. Valida che sia un numero positivo con al massimo due decimali.

## Navigazione

Il **menu hamburger** in alto a sinistra è la mappa dell'app: contiene *tutte* le schermate. La **barra in basso** è solo un accesso rapido alle quattro più frequenti (Home, Storico, Lista, Casa). Le voci di entrambe stanno in `lib/nav.ts`: aggiungendo una schermata va aggiunta lì, e finisce nel menu senza toccare la barra — la barra non cresce.

## Schermate principali

Le quattro schermate del MVP, con una bottom navigation persistente che lega home, storico e conguaglio.

La **home** mostra in alto il nome dell'app, poi una card prominente con il saldo corrente ("Tu devi X € a Y" oppure "Y ti deve X €", a seconda di chi guarda), sotto un riepilogo dei totali anticipati da ciascuno, poi le ultime 3-5 spese. FAB in basso a destra per aprire rapidamente "Nuova spesa".

La schermata di **inserimento spesa** può essere a tutto schermo o modale dal basso. Campo importo grosso e prominente in cima, poi descrizione, categoria (chip o select), regola di divisione (due chip: 50/50 e 60/40, pre-selezionata in base alla categoria), pagato da (due chip con i nomi dei partner), data (default oggi). Bottone salva ben visibile in fondo.

Lo **storico** è una lista raggruppata per giorno, ordinata dalla più recente. In cima, filter chip per mese, per stato (aperta/saldata/tutte) e per categoria. Con poche decine di righe non serve virtualizzazione — se mai crescesse molto, si può aggiungere dopo. Tap su una riga apre il dettaglio.

Il **conguaglio** mostra una card riepilogativa con il saldo netto e la direzione del bonifico (freccia da chi deve a chi riceve), sotto l'elenco delle spese che verranno chiuse con il rispettivo contributo al saldo, e in fondo due bottoni: conferma e annulla. Alla conferma chiama `register_settlement`.

## Cose da NON fare

Queste sono scritte come lista apposta perché sono il tipo di errore che è facile commettere per inerzia e che costa tempo riparare:

- Non ricalcolare il saldo lato client: usa `v_user_open_balance`
- Non scrivere logica custom per il conguaglio: chiama la RPC `register_settlement`
- Non creare una pagina di signup pubblica: i due utenti sono gestiti manualmente
- Non aggiungere funzionalità fuori scope MVP (grafici, export CSV, budget mensili, spese ricorrenti automatiche): la sezione 8 dei requisiti le elenca esplicitamente come evoluzioni future. Le notifiche e le foto degli scontrini erano in quell'elenco ma sono state realizzate su richiesta esplicita: vedi "Integrazione Telegram" qui sotto. Stesso discorso per la lista della spesa: vedi "Lista della spesa" più sotto
- Non modificare lo schema SQL senza aggiornare anche `casa_nostra_schema.sql`
- Non duplicare le policy RLS con controlli client-side come se fossero sicurezza: la sicurezza è in DB

## Convenzioni di codice

Giusto una manciata per tenere le cose consistenti. File e cartelle in `kebab-case`, tranne i componenti React che sono `PascalCase.tsx`. Client Supabase separati in `lib/supabase/` (browser, server, middleware). Tipi TypeScript generati da Supabase con `supabase gen types typescript` e messi in `types/database.ts`. Componenti UI generici in `components/ui/`, quelli specifici del dominio in `components/`. Evita `any`: se ti serve una scappatoia usa `unknown` e poi restringi.

## Criteri di successo

Dai requisiti, in ordine di importanza: inserire una spesa in meno di 30 secondi, saldo sempre coerente e aggiornato in tempo reale, conguaglio completo in meno di un minuto, storico fluido con decine di voci, e — il più importante — i due utenti la usano davvero nella vita di tutti i giorni. L'ultimo non dipende dal codice; i primi quattro sì, quindi tienili a mente mentre implementi.

## Integrazione Telegram

Un bot Telegram opzionale collega l'app al gruppo dei due conviventi. Fa due cose: **notifica** ogni movimento (spesa creata/modificata/eliminata, conguaglio registrato o richiesto) con il saldo aggiornato, e **risponde** nel gruppo con lo stesso assistente IA della chat interna, potendo quindi registrare spese o fare riepiloghi da Telegram.

Cose da sapere prima di metterci mano:

- **Il motore dell'assistente è condiviso**: sta in `lib/assistant/` (tool, system instruction, ciclo di tool calling) e accetta un client Supabase esplicito. `app/api/assistant/route.ts` e `app/api/telegram/webhook/route.ts` sono due gusci sottili sopra `runAssistant`. Se aggiungi un tool o cambi il prompt, lo fai una volta sola lì — non duplicare la logica in un canale solo.
- **Il webhook non ha sessione**: usa il client service role (`lib/supabase/service.ts`), che bypassa RLS. L'autorizzazione la fanno il secret dell'update e il collegamento `profiles.telegram_user_id`. Non usare quel client altrove e non esporre mai `SUPABASE_SERVICE_ROLE_KEY` al browser.
- **Le notifiche non stanno nel percorso critico**: si preparano nella Server Action e si inviano con `after()`. Non aggiungere `await` su Telegram prima di rispondere all'utente (l'unica eccezione voluta è `requestSettlementOnTelegram`, dove l'esito serve per il toast).
- **L'integrazione è spegnibile**: senza `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` tutto il codice Telegram esce subito e l'app si comporta come prima. Mantieni questa proprietà.
- **Configurazione e troubleshooting**: `docs/telegram-setup.md`. Schema: sezione 10 di `casa_nostra_schema.sql` e `docs/migrations/2026-09-03_telegram.sql`.

## Lista della spesa

Il modulo `/lista` tiene traccia di cosa manca in casa: articoli con tipo di prodotto, quantità in testo libero e urgenza, più il **controllo scontrino** che confronta una foto con la lista e spunta in automatico quello che è stato comprato. Documentazione completa nella wiki (sezioni 02, 03, 04, 05); qui le cose da sapere prima di metterci mano:

- **La logica di dominio sta in `lib/shopping/service.ts`, non nelle Server Action.** È la stessa scelta dell'assistente: quel modulo riceve sempre un client Supabase esplicito, così Server Action (sessione), assistente e webhook Telegram (service role) eseguono la stessa identica logica. Se aggiungi un'operazione sulla lista, aggiungila lì e chiamala dai tre lati — non duplicarla nei tool come è successo per le spese.
- **Lo stato è sul database, come il saldo.** "Cosa manca dall'ultimo scontrino" è la vista `v_shopping_missing_since_last_check`, il controllo scontrino è la RPC transazionale `register_receipt_check`. Non ricostruire quelle risposte lato client confrontando date.
- **Un articolo è aperto se `bought_at IS NULL`**, esattamente come una spesa è aperta se `settlement_id IS NULL`. I doppioni tra gli articoli aperti li blocca un indice unico parziale: l'errore `23505` si traduce in un messaggio, non si previene con una SELECT.
- **Aggiungere alla lista non chiede conferma**, né nell'app né via assistente: non muove soldi e si annulla con un tap. La conferma resta dove serve — eliminare un articolo, svuotare lo storico.
- **Le notifiche Telegram della lista sono volutamente poche**: solo l'esito di un controllo scontrino e l'aggiunta di un articolo urgente. Notificare ogni prodotto renderebbe rumore anche le notifiche delle spese.
- **Il riconoscimento dei prodotti sullo scontrino lo fa Gemini**, in una sola chiamata che legge l'immagine e la confronta con la lista. Gli id che il modello restituisce vengono sempre riverificati contro la lista reale prima di scrivere.
- **Uno scontrino mandato su Telegram registra anche la spesa** (`lib/shopping/receipt-expense.ts`), con le opzioni di default del form: totale e data dello scontrino, pagante chi manda la foto, `DEFAULT_SPLIT` per la categoria, foto allegata alla spesa. Non succede per il controllo fatto dall'app, dove il form è a un tap di distanza. Non creare mai la spesa in silenzio: il messaggio deve sempre dire cosa è stato registrato o perché no (totale illeggibile, doppione dello stesso importo in quella data).

## Workflow di fine sessione

Quando ti viene chiesto di chiudere una sessione, pushare su GitHub e/o pubblicare in produzione su Vercel, segui **sempre** questo ordine:

1. **Scrivi il dev log del giorno** in `docs/dev-log-YYYY-MM-DD.md` seguendo il formato dei log esistenti (sezioni con titolo, motivazione, soluzione tecnica dove rilevante). Guarda i file già presenti in `docs/` come riferimento stilistico.
2. **Committa tutto** — incluso il dev log appena creato.
3. **Pusha su GitHub** (se richiesto).
4. **Deploy su Vercel** (se richiesto), con i preflight check di rito.

Non saltare o invertire i passi: il dev log deve essere nel commit di chiusura sessione, non in uno separato dopo.

---

Se trovi ambiguità tra questo file, i requisiti e lo schema SQL, fermati e chiedi prima di inventare. In caso di conflitto la fonte autoritativa sono i due file originali (requisiti e SQL), non questo AGENTS.md.