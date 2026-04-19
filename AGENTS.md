<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — Casa Nostra

Questo file ti serve da briefing prima di scrivere codice. Non è esaustivo: i documenti autoritativi sono altri due, e in caso di conflitto vincono loro.

- `docs\Casa_Nostra_Requisiti_MVP.docx` — requisiti funzionali completi
- `docs\casa_nostra_schema.sql` — schema Supabase già definito e applicato

Leggili entrambi prima di iniziare. Questo file riassume le cose più importanti e aggiunge convenzioni tecniche e raccomandazioni pratiche.

## Cosa stiamo costruendo

Casa Nostra è un'app web mobile-first per due persone conviventi che vogliono gestire le spese di casa in modo trasparente. L'idea è semplice: ogni spesa inserita nell'app è, per definizione, condivisa. Esistono due sole regole di divisione: 50/50 per l'affitto, e 60/40 per tutto il resto (dove il partner con reddito maggiore paga il 60%). L'app mostra in ogni momento chi deve quanto all'altro — il "saldo" — e permette di chiudere tutto con un "conguaglio" quando uno dei due bonifica all'altro la differenza.

È pensata esclusivamente per due utenti fissi. Non serve un sistema di registrazione pubblico: i due account vengono creati manualmente in Supabase prima del primo avvio.

## Stack tecnico

Il progetto è già inizializzato con l'ultima versione di Next.js (App Router) e Tailwind CSS. Il database è Supabase (Postgres + Auth) e lo schema è già applicato. Assumo TypeScript abilitato, che è il default dei template moderni di Next.

Non ho verificato personalmente le versioni esatte presenti nel `package.json` del progetto, quindi se trovi discrepanze tra queste indicazioni e quanto effettivamente installato, segnalalo invece di forzare.

## Regole di dominio (le più importanti)

Le regole di business sono già codificate nel database, ma l'app deve rispettarle coerentemente anche lato client.

**Default della regola di divisione all'inserimento.** Quando l'utente sceglie la categoria `affitto`, il default proposto è `fifty_fifty`; per ogni altra categoria il default è `sixty_forty`. Il default deve sempre essere modificabile dall'utente prima del salvataggio.

**Calcolo del saldo.** Non calcolarlo lato client sommando le spese a mano. Esiste già la vista `v_user_open_balance` che fa tutto: per ogni utente restituisce `total_anticipated`, `total_owed` e `net_position`. Il saldo da mostrare in home è semplicemente il valore assoluto di uno dei due `net_position`, con l'indicazione di chi deve a chi (chi ha `net_position` positivo è in credito, l'altro gli deve soldi).

**Conguaglio.** Non scrivere logica transazionale custom. Esiste la funzione RPC `register_settlement(p_notes text)` che in un'unica transazione crea la riga in `settlements` e marca tutte le spese aperte come saldate. Chiamala con `supabase.rpc('register_settlement', { p_notes: ... })`. Solleva un'eccezione se il saldo è zero, quindi gestisci quel caso a monte disabilitando il bottone.

**Spesa aperta vs saldata.** Una spesa è "aperta" quando `settlement_id IS NULL`, "saldata" altrimenti. Solo le aperte entrano nel saldo corrente. Le saldate restano nello storico, visibili ma con stato distinto.

**Validazioni.** Lo schema ha già i check constraints giusti (importo > 0, descrizione non vuota, `from_user_id <> to_user_id`, ecc.) e ha RLS attivo su tutte le tabelle. Non duplicare questi vincoli lato client come se fossero la sicurezza — però fai comunque validazione lato form per dare una UX decente: feedback immediato, niente submit che falliscono al round-trip.

## Autenticazione

Gestita interamente da Supabase Auth. I due utenti sono creati manualmente dal pannello Supabase e i rispettivi record in `public.profiles` sono inseriti a mano (vedi sezione 9 dello schema SQL). Non devi implementare signup né reset password — solo login.

Raccomandazione pratica (non un requisito del documento): usa il pacchetto `@supabase/ssr` per integrare Supabase con l'App Router. Ti dà i tre client separati (browser, server, middleware) di cui hai bisogno. Aggiungi un middleware Next per rinfrescare la sessione a ogni richiesta e redirigere gli utenti non autenticati su `/login`.

## Architettura suggerita

Questa sezione è un suggerimento di mia inferenza, non un requisito. L'app è piccola e qualsiasi organizzazione sensata funziona.

Per il routing, usa l'App Router con questi segment:

- `/login` — pagina pubblica di autenticazione
- `/` — home con saldo e ultime spese
- `/spese` — storico completo con filtri
- `/spese/nuova` — inserimento (o come modale che si apre sopra la home)
- `/spese/[id]` — dettaglio e modifica di una spesa
- `/conguaglio` — schermata dedicata al conguaglio

Per le mutations (crea/modifica/elimina spesa, registra conguaglio) preferisci Server Actions rispetto ad API route: meno boilerplate, integrazione naturale con i form e con `useActionState`. Per le query (liste, dettagli, saldo) va bene caricare i dati direttamente in Server Component.

Dove ti serve interattività client-side (chip selezionabili, input importo con formattazione, filtri dinamici dello storico), isola il Client Component il più possibile verso le foglie, mantenendo il resto server-side.

## Stile grafico e UI

L'app è mobile-first. Deve essere comoda con una sola mano, e deve risultare a proprio agio sia su Android che su iOS.

Su questo punto c'è una piccola tensione che vale la pena esplicitare: il documento dei requisiti cita Material Design 3 come ispirazione, ma Material su iPhone si nota eccome come "estraneo". La mia raccomandazione (è una mia scelta, non un requisito) è di andare su uno stile "neutro moderno" — think Linear, Vercel, shadcn/ui: pulito, minimale, gerarchia tipografica chiara, card con ombre morbide, angoli arrotondati moderati. Non grida "Android" né "iOS" e si integra bene su entrambi. Se preferisci aderire più strettamente a Material 3 come dice il documento, va bene ugualmente — sappi solo che su iOS sembrerà un po' meno "nativo".

Alcune linee guida concrete:

**Tipografia.** Usa il system font stack (`ui-sans-serif, system-ui, -apple-system, ...`) così su iOS diventa San Francisco e su Android Roboto. Tailwind lo fa già di default con `font-sans`.

**Touch target.** Minimo 44px (linea guida iOS) / 48dp (Android). Con Tailwind, `h-11` è il minimo ragionevole per bottoni e row tappabili.

**Safe area.** iOS ha notch e home indicator, Android ha la gesture bar. Usa `env(safe-area-inset-*)` per la bottom navigation, il FAB e l'header. In Tailwind: classi come `pb-[env(safe-area-inset-bottom)]`.

**Colori.** Un solo accent (un verde o un blu-teal funzionano bene per un'app di "casa e soldi") e per il resto neutri. Supporto dark mode via `dark:` di Tailwind basato su `prefers-color-scheme`: il documento lo richiede esplicitamente.

**Componenti.** Ti consiglio di valutare [shadcn/ui](https://ui.shadcn.com) — componenti copia-incolla basati su Radix e Tailwind, accessibili e stilabili. Si sposano bene con il look neutro descritto sopra. Non è un obbligo: Tailwind puro va benissimo. Questa è una raccomandazione mia.

**Feedback.** Ogni salvataggio, eliminazione o conguaglio deve dare feedback visivo immediato (toast, cambio stato del bottone, loading). Le azioni distruttive — eliminazione di una spesa e conferma di un conguaglio — richiedono sempre una seconda conferma tramite dialog. Questo è nei requisiti.

**Lingua e formati.** Tutta l'UI in italiano. Importi in euro con due decimali e separatore virgola: `Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })`. Date in formato italiano con `Intl.DateTimeFormat('it-IT')`. Non serve un sistema di i18n complesso — stringhe inline o un semplice modulo di costanti bastano.

**Input importo.** Su mobile usa `inputMode="decimal"` sull'input dell'importo per far apparire la tastiera numerica. Valida che sia un numero positivo con al massimo due decimali.

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
- Non aggiungere funzionalità fuori scope MVP (notifiche, grafici, export CSV, foto scontrini, budget mensili, spese ricorrenti automatiche): la sezione 8 dei requisiti le elenca esplicitamente come evoluzioni future
- Non modificare lo schema SQL senza aggiornare anche `casa_nostra_schema.sql`
- Non duplicare le policy RLS con controlli client-side come se fossero sicurezza: la sicurezza è in DB

## Convenzioni di codice

Giusto una manciata per tenere le cose consistenti. File e cartelle in `kebab-case`, tranne i componenti React che sono `PascalCase.tsx`. Client Supabase separati in `lib/supabase/` (browser, server, middleware). Tipi TypeScript generati da Supabase con `supabase gen types typescript` e messi in `types/database.ts`. Componenti UI generici in `components/ui/`, quelli specifici del dominio in `components/`. Evita `any`: se ti serve una scappatoia usa `unknown` e poi restringi.

## Criteri di successo

Dai requisiti, in ordine di importanza: inserire una spesa in meno di 30 secondi, saldo sempre coerente e aggiornato in tempo reale, conguaglio completo in meno di un minuto, storico fluido con decine di voci, e — il più importante — i due utenti la usano davvero nella vita di tutti i giorni. L'ultimo non dipende dal codice; i primi quattro sì, quindi tienili a mente mentre implementi.

## Workflow di fine sessione

Quando ti viene chiesto di chiudere una sessione, pushare su GitHub e/o pubblicare in produzione su Vercel, segui **sempre** questo ordine:

1. **Scrivi il dev log del giorno** in `docs/dev-log-YYYY-MM-DD.md` seguendo il formato dei log esistenti (sezioni con titolo, motivazione, soluzione tecnica dove rilevante). Guarda i file già presenti in `docs/` come riferimento stilistico.
2. **Committa tutto** — incluso il dev log appena creato.
3. **Pusha su GitHub** (se richiesto).
4. **Deploy su Vercel** (se richiesto), con i preflight check di rito.

Non saltare o invertire i passi: il dev log deve essere nel commit di chiusura sessione, non in uno separato dopo.

---

Se trovi ambiguità tra questo file, i requisiti e lo schema SQL, fermati e chiedi prima di inventare. In caso di conflitto la fonte autoritativa sono i due file originali (requisiti e SQL), non questo AGENTS.md.