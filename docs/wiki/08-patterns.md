# Pattern di Design e Principi di UI/UX

Questa pagina documenta i pattern architetturali grafici, i principi di design del frontend, l'integrazione di Material Design 3 e i pattern interattivi applicati a **Casa Nostra**.

> **Redesign "teal evoluto" (luglio 2026).** Il flusso spese (home, inserimento, storico, dettaglio, conguaglio) è stato riprogettato in chiave fintech (riferimenti: Revolut, N26, Monzo, Splitwise). La logica dati (vista `v_user_open_balance`, RPC `register_settlement`, Server Actions, flusso ottimistico) è rimasta invariata: sono cambiati solo design system e presentazione. Le sezioni sotto riflettono lo stato aggiornato.

---

## Design system

### 1. Palette di Colori "teal evoluto"
I colori sono dichiarati come CSS Variables in `app/globals.css`. I valori dark sono definiti una sola volta come `--dk-*` su `:root`; i due blocchi dark (media query `prefers-color-scheme` e override `[data-theme="dark"]`) si limitano a riassegnare gli alias ai `--dk-*`, per evitare duplicazione.

* **Light**:
  * Sfondo (`--background`): `#f6f8f7` — superficie neutra e pulita.
  * Primario (`--accent`): `#006a60` — teal "denaro" più profondo (AA 6.50:1 su bianco).
  * Contenitore tonale (`--accent-muted`): `#d3f3ee`.
  * Positivo (`--positive`): `#047857` — saldo a credito / importi positivi (mai rosso: è un saldo di coppia).
* **Dark**:
  * Sfondo (`--background`): `#0b100f` — near-black neutro a tinta teal.
  * Primario (`--accent`): `#2fd5c8` — accento mint saturo, alta leggibilità.
  * Positivo (`--positive`): `#34d399`.

Gli alias storici del progetto (`--surface`, `--accent-muted`, `--muted`, `--border`, ecc.) sono mantenuti: cambiano solo i valori, non i nomi. Nuovi token semantici: `--positive` / `--positive-muted` / `--positive-soft` (utility `text-positive`, `bg-positive-muted`, …). Costanti hex JS (per metadata/status bar Next) in `lib/theme.ts`.

### 2. Tipografia
* **Inter** (variable, range 100–900) self-hostato via `next/font/local` da `app/fonts/inter-latin-wght-normal.woff2` → `app/layout.tsx`. Niente fetch build-time da Google Fonts (che su alcuni ambienti Windows fa crashare Node nello store certificati); build riproducibili.
* Lo stack `--font-sans` antepone Inter al system font stack. `font-feature-settings: "ss01","cv11","tnum"` (feature di Inter) sul body.
* Scala distintiva per i grandi numeri (in `@theme`): `--text-display` (2.5rem), `--text-display-sm` (2rem), `--text-title` (1.125rem), `--text-label` (0.8125rem). Saldi con peso 750–800, `tracking` stretto e `tabular-nums` via il componente `AmountDisplay`.

### 3. Forme e Raggi (Shapes & Radius)
* **Pulsanti (pill)**: tutti `rounded-full` → `components/ui/Button.tsx` (size `sm`/`md`/`lg`; `lg` = `h-13`). Hover via `color-mix` (scurisce/tinge il fill) invece dell'opacity. Variant `outline` aggiunta.
* **Card (medium)**: `16px` (`rounded-2xl`), bordo pieno, **opache** (niente `bg-surface/xx backdrop-blur`), prop `tone` (`default`/`raised`/`sunken`) → `components/ui/Card.tsx`.
* **FAB**: `rounded-full` con `shadow-fab` e micro-feedback (`whileTap`) → `components/NuovaSpesaFab.tsx`.
* **Dialog e Bottom Sheet (extra-large)**: `28px` (`rounded-[28px]` / `rounded-t-[28px]`) → `components/ui/Dialog.tsx`, `components/ui/Sheet.tsx`. Lo `Sheet` supporta `size` (`auto`/`full`) e header/footer sticky.
* Le ombre seguono una scala **più piatta** (fintech = bordi + contrasto di superficie), quasi nulle in dark.

### 4. Primitive condivise
Componenti riusabili in `components/ui/` e `components/`:
* `AmountDisplay` — grandi importi (`size`, `tone neutral|positive|negative`).
* `AmountInput` — hero importo con simbolo € (`size hero|md`); usato dai form spesa.
* `SegmentedControl` — tab animati con pillola `layoutId` (usato da storico e statistiche).
* `Chip` — chip filtro/suggerimento (`variant filter|suggestion`).
* `ListRow` — riga generica leading/title/subtitle/trailing (base di `ExpenseRow`, dettaglio, conguaglio).
* `CategoryIcon` — avatar categoria tinto (`size sm|md|lg`), tinta da `CATEGORY_VISUAL`.
* `Avatar` — cerchio con le iniziali (`highlighted` per il tono pieno, `size sm|md`); estratto da `BalanceCard` quando è servito anche al feed del modulo faccende (`ChoreLogRow`), invece di duplicare `initialsOf`/il markup una seconda volta.
* `ExpenseFormFields` (`components/expense/`) — campi condivisi tra creazione e modifica; i due form restano wrapper sottili con le rispettive Server Action e logica ottimistico/allegati.

### 5. Palette categorica (icone + grafici)
Unica fonte di verità `CATEGORY_VISUAL` in `lib/fmt.ts`: per ogni categoria `{ hex, hexDark, container }`. Validata CVD (protan/deutan). I grafici (`recharts`) scelgono `hex`/`hexDark` in base al tema tramite `categoryHex(cat, isDark)`; le icone usano `container` (tinta ~15%). `CATEGORY_COLOR` resta come alias derivato.

### 6. Motion
Preset spring condivisi in `lib/motion.ts` (`springSnappy`, `springSoft`, `springLayout`, `durationFast`), usati da BottomNav, SegmentedControl, BalanceCard, FAB.

### 7. Indicatori Attivi di Navigazione (BottomNav M3)
La barra in basso applica il pattern M3 active indicator → `components/BottomNav.tsx`: una pillola (`bg-accent-muted`) compare dietro l'icona del tab attivo e si sposta con `motion.span` + `layoutId="nav-pill"` (`springLayout`). Ombra tokenizzata (`shadow-nav`).

**Composizione dei tab (settembre 2026, modulo "Gestione casa").** Quattro voci: Home · Storico · **Casa** · Conguaglio. Statistiche è stata spostata nel `Sheet` "Menu" dell'header (insieme a "Catalogo faccende") perché la barra riflette la *frequenza d'uso*, non l'importanza dei moduli: le faccende sono l'interazione più frequente dell'app, il conguaglio la più rara → `docs/design-modulo-gestione-casa.md § 6`.

**Navigazione attuale: menu completo + barra ridotta.** Il menu hamburger in alto a sinistra (`AppHeader`) è la **mappa dell'app** — elenca tutte le schermate, ognuna con una riga di spiegazione e l'evidenza di quella corrente — mentre la barra in basso è un **accesso rapido** alle quattro che si aprono più volte al giorno: Home · Storico · **Lista** · Casa. Il conguaglio è nel menu insieme a Statistiche, Catalogo faccende e Impostazioni: è l'azione più rara dell'app (`docs/design-modulo-gestione-casa.md § 6`), e la barra riflette la frequenza d'uso, non la mappa. La conseguenza pratica è che un modulo nuovo entra nel menu senza costringere a spostare qualcos'altro, e la barra non cresce oltre le quattro voci (a cinque le etichette scendono sotto i 60px sui telefoni piccoli e vanno rimpicciolite).

Voci, ordine ed etichette corte stanno tutti in `lib/nav.ts`, con `activeNavHref()` che sceglie la voce attiva come href più lungo che è prefisso del percorso — così `/casa/catalogo` illumina "Catalogo faccende" nel menu e il tab "Casa" nella barra.

---

## Tailwind CSS v4 e PostCSS

* **Configurazione CSS-First**: nessun `tailwind.config.js`. Tema, token e utility via `@theme` in `app/globals.css`. I token colore/ombra sono registrati in `@theme inline`.
* **Integrazione**: plugin PostCSS `@tailwindcss/postcss` → `postcss.config.mjs`.
* **Nota**: i token radius NON sovrascrivono le utility `rounded-*` di base (per non rimappare gli usi esistenti in tutto il codebase); i componenti del redesign usano raggi espliciti.

---

## Safe Area e Mobile Viewports

* **Viewport Config**: `viewportFit: 'cover'` + `interactiveWidget: 'resizes-content'` (tastiera su Android) + `themeColor` light/dark da `lib/theme.ts` → `app/layout.tsx`.
* **Safe Area Top**: `AppHeader` e container principale con padding superiore sulla safe area → `app/(app)/layout.tsx`.
* **Safe Area Bottom**: `BottomNav` e FAB usano `env(safe-area-inset-bottom)`; sheet, pannello assistente e footer sticky dei form usano `var(--safe-bottom)`, che è la stessa cosa ma si azzera con la tastiera aperta.
* **Tastiera software**: `components/KeyboardInsets.tsx` (montato nel layout radice) misura con `visualViewport` quanto della finestra copre la tastiera — `innerHeight - height - offsetTop`, soglia 120px — e lo pubblica in `--keyboard-inset` su `<html>`, insieme a `data-keyboard="open"`. Serve perché su iOS la tastiera non accorcia il layout viewport: un `fixed bottom-0` (e un'altezza in `svh`) finirebbe sotto la tastiera. Chi vive in fondo allo schermo usa `bottom-[var(--keyboard-inset)]` e sottrae l'inset dalla propria altezza massima; `.hide-on-keyboard` nasconde bottom nav e FAB mentre si scrive; alla comparsa della tastiera il campo a fuoco viene centrato con `scrollIntoView`.

---

## Pattern di schermata (redesign)

* **Home** — hero balance (Revolut/Monzo): saldo grande con `AmountDisplay` (verde se a credito), pill direzione avatar→freccia→avatar, CTA inline "Conguaglia", riga di stat-tile. Card opache, clearance FAB (`pb-24`) → `components/HomeShell.tsx`, `components/BalanceCard.tsx`.
* **Inserimento spesa** — amount-first (Monzo/Splitwise) in `Sheet size="full"` con footer sticky per il Salva → `components/expense/ExpenseFormFields.tsx`.
* **Storico** — search pill + un'unica riga di chip (chip "Filtri" apre uno `Sheet` filtri esteso); header giorno sticky con totale del giorno (pattern N26) → `app/(app)/spese/SpeseFiltri.tsx`.
* **Dettaglio** — hero recap (`CategoryIcon` + `AmountDisplay` + badge stato) e transaction detail su `ListRow` → `app/(app)/spese/[id]/page.tsx`.
* **Conguaglio** — payment-confirm: hero saldo, righe con `Checkbox` + `CategoryIcon` (deselezione via sola opacità), barra azione solida fusa con la BottomNav, conferma in `Sheet` payment-confirm → `app/(app)/conguaglio/ConguaglioClient.tsx`.
* **Lista della spesa** (`/lista`) — articoli raggruppati per tipo di prodotto in mini-`Card` (stesso pattern dei gruppi per area di `/casa`), `Checkbox` a sinistra per spuntare in un tap e il resto della riga che apre il form di modifica. In cima, quando c'è, la card di **quello che è rimasto fuori dall'ultimo scontrino**: è l'unica informazione che merita di stare sopra la lista, perché è l'unica che si scorda; le stesse righe restano evidenziate anche dentro i gruppi (`bg-destructive/5` + sottotitolo). L'urgenza colora **solo** il badge "Urgente": se tutto è evidenziato, niente lo è — per lo stesso motivo `ShoppingIcon` usa un contenitore neutro invece della scala per categoria delle spese → `app/(app)/lista/ShoppingShell.tsx`.
  * **Reset del form senza `useEffect`**: `ItemFormSheet` inizializza i campi dalle prop e viene rimontata cambiando `key` a ogni apertura (`formKey` in `ShoppingShell`), invece di risincronizzare lo stato in un effetto — è il rimedio indicato da React ("you might not need an effect") ed evita il `react-hooks/set-state-in-effect` del lint.
  * **Il file dello scontrino non passa dalla Server Action**: il browser lo carica su Storage e la action lo rilegge da lì (il body di una Server Action è limitato a 1 MB), stessa strada già usata dagli allegati delle spese → `components/shopping/ReceiptCheckSheet.tsx`.
* **Gestione casa** (`/casa`) — liste "Da fare" / "Gesti" / "Fatto di recente" su `Card` opache con `ChoreRow` (bottone "Fatto" inline, nessun dialog di conferma: non è un'azione distruttiva) e UI ottimistica identica al pattern §1 sotto; FAB apre `RegisterChoreSheet` per registrare qualsiasi faccenda del catalogo, anche fuori cadenza o retrodatata → `components/chores/ChoreShell.tsx`.
  * **Fase 2 (implementata)**: in cima alla schermata, `ChoreWelcomeHeader` saluta con l'ora del giorno (`suppressHydrationWarning` sul saluto: dipende dall'ora locale, che server UTC e client Europe/Rome possono calcolare diversamente ai bordi fascia — è l'escape hatch corretto di React per questo caso, non un bug da correggere). Sotto, `WeekGoalCard` mostra XP di casa verso l'obiettivo settimanale come una "bottiglia" a 5 tacche (`GoalBottle`, sostituisce la barra lineare originale), la striscia (🔥, solo settimane *concluse* che hanno raggiunto l'obiettivo), un banner "Obiettivo raggiunto" che entra con `AnimatePresence` quando lo si supera, e i chip di riepilogo per area (`v_chore_week_area`, a livello di casa). **Niente barra di equilibrio**: c'era (zona morta 30–70%), è stata rimossa (decisione 9, `docs/design-modulo-gestione-casa.md`) perché restava comunque un confronto Tu/Lui-Lei esplicito fuori dalla zona morta — la card ora mostra solo dati di casa, mai spezzati per persona.
  * **"Da fare"** è raggruppato per area in mini-`Card` separate (header con emoji + etichetta su sfondo `bg-surface-sunken/60`, cliccabile per **collassare/espandere** il gruppo — `collapsedAreas` in `ChoreShell.tsx`, un `Set` di aree collassate, animato con `height: 'auto'`/`AnimatePresence`), non più un'unica lista piatta ordinata solo per urgenza: la categorizzazione visiva era la richiesta esplicita, l'ordinamento per urgenza resta preservato *dentro* ogni area (funzione `groupByKey` in `ChoreShell.tsx`, che raggruppa preservando il primo ordine di comparsa — a differenza di un raggruppamento "a blocchi contigui", serve perché l'elenco è ordinato per scadenza e non per area). Sopra i gruppi, una riga di `Chip` a scorrimento orizzontale filtra per area (stesso pattern single-select "Tutte" + una per categoria di `SpeseFiltri.tsx`, stesso `touchAction: pan-x` per non confliggere con il pull-to-refresh).
  * **"Fatto di recente"** è raggruppato per giorno (`formatChoreDayLabel`: "Oggi"/"Ieri"/data estesa, `romeDateKey` per la chiave nel fuso Europe/Rome), e ogni riga porta un `Avatar` (iniziali, tono pieno se "sei tu") accanto al nome di chi l'ha fatta — la richiesta di "confronti con le attività dell'altro" risolta come **visibilità reciproca senza punteggio a confronto**: vedi `docs/design-modulo-gestione-casa.md`, decisione 7. `ChoreLogRow` aggiunge anche una riga di 4 reazioni-emoji (kudos) sulle faccende dell'altro e un'icona cestino con `Dialog` di conferma per eliminare una propria registrazione in qualsiasi momento, non solo nella finestra del toast "Annulla".
  * **Feedback tattile**: `CelebrationBurst` (`components/chores/`) è un piccolo "pop" che compare sopra il bottone "Fatto" al tap e si richiude da solo via `onAnimationComplete` — nessun `useEffect`, perché è un evento puntuale innescato dal click, non uno stato da sincronizzare.
  * **XP visibili su ogni riga**: `ChoreRow` (badge neutro "N XP", valore potenziale) e `ChoreLogRow` (badge tonale positivo "+N XP", valore già guadagnato) mostrano l'XP della singola faccenda — così come già in `/casa/catalogo` e nella lista di `RegisterChoreSheet`. Non è in tensione con "XP registrati ma non mostrati" della fase 1: quel principio riguardava i **punteggi aggregati** (obiettivo, striscia, equilibrio — arrivati in fase 2, dietro l'interruttore "gamification" sotto), non il valore della singola faccenda, che è un'informazione sul task (quanto "pesa"), non un punteggio personale.

---

## Pattern di UI Interattiva

### 1. Interfaccia Ottimistica (Optimistic UI)
Applicata nell'inserimento spese per azzerare l'attesa percepita → `components/HomeShell.tsx`:
* All'invio, la spesa entra subito in uno stato React temporaneo (`optimistic`) con ID provvisorio e il sheet si chiude.
* La lista unisce spese ottimistiche e reali (`combined`).
* Al termine della Server Action (`revalidatePath`), Next.js rinfresca i dati; lo stato ottimistico viene ripulito e sostituito silenziosamente dalla riga persistita.

### 2. Transizioni di Pagina
Transizioni tra rotte e apertura delle modali via `motion/react` → `components/PageTransition.tsx`, animate su opacità e traslazione Y.

### 3. Tema (dark mode)
Doppio meccanismo: `prefers-color-scheme` + override utente `data-theme` con script anti-FOUC in `app/layout.tsx`. Il selettore è raggiungibile dal `ThemeToggle` nel Sheet "Moduli" dell'header → `components/AppHeader.tsx`.

### 3b. Interruttore "gamification" (Gestione casa, fase 2)
Preferenza per-dispositivo come il tema, non stato applicativo condiviso: vive in `localStorage`, non nel DB, e i due utenti possono impostarla diversamente. A differenza di `ThemeToggle` (che sincronizza `useState` con `localStorage` dentro un `useEffect`, con un `mounted` gate per evitare il flash), `lib/chores/gamification.ts` usa `useSyncExternalStore` — evita sia il mismatch di idratazione SSR/client sia il pattern "`setState` dentro un effect" che `eslint-plugin-react-hooks` segnala altrove nel progetto. Il segnale di cambiamento nello stesso tab (l'evento nativo `storage` scatta solo fra tab diversi) è un `CustomEvent` dedicato. Controllo in `/impostazioni` → `components/chores/GamificationToggle.tsx`; consumo in `components/chores/WeekGoalCard.tsx` (che ritorna `null` se disattivato).
