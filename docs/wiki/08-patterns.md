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
* `ExpenseFormFields` (`components/expense/`) — campi condivisi tra creazione e modifica; i due form restano wrapper sottili con le rispettive Server Action e logica ottimistico/allegati.

### 5. Palette categorica (icone + grafici)
Unica fonte di verità `CATEGORY_VISUAL` in `lib/fmt.ts`: per ogni categoria `{ hex, hexDark, container }`. Validata CVD (protan/deutan). I grafici (`recharts`) scelgono `hex`/`hexDark` in base al tema tramite `categoryHex(cat, isDark)`; le icone usano `container` (tinta ~15%). `CATEGORY_COLOR` resta come alias derivato.

### 6. Motion
Preset spring condivisi in `lib/motion.ts` (`springSnappy`, `springSoft`, `springLayout`, `durationFast`), usati da BottomNav, SegmentedControl, BalanceCard, FAB.

### 7. Indicatori Attivi di Navigazione (BottomNav M3)
La barra in basso applica il pattern M3 active indicator → `components/BottomNav.tsx`: una pillola (`bg-accent-muted`) compare dietro l'icona del tab attivo e si sposta con `motion.span` + `layoutId="nav-pill"` (`springLayout`). Ombra tokenizzata (`shadow-nav`).

**Composizione dei tab (settembre 2026, modulo "Gestione casa").** Quattro voci: Home · Storico · **Casa** · Conguaglio. Statistiche è stata spostata nel `Sheet` "Menu" dell'header (insieme a "Catalogo faccende") perché la barra riflette la *frequenza d'uso*, non l'importanza dei moduli: le faccende sono l'interazione più frequente dell'app, il conguaglio la più rara → `docs/design-modulo-gestione-casa.md § 6`.

---

## Tailwind CSS v4 e PostCSS

* **Configurazione CSS-First**: nessun `tailwind.config.js`. Tema, token e utility via `@theme` in `app/globals.css`. I token colore/ombra sono registrati in `@theme inline`.
* **Integrazione**: plugin PostCSS `@tailwindcss/postcss` → `postcss.config.mjs`.
* **Nota**: i token radius NON sovrascrivono le utility `rounded-*` di base (per non rimappare gli usi esistenti in tutto il codebase); i componenti del redesign usano raggi espliciti.

---

## Safe Area e Mobile Viewports

* **Viewport Config**: `viewportFit: 'cover'` + `themeColor` light/dark da `lib/theme.ts` → `app/layout.tsx`.
* **Safe Area Top**: `AppHeader` e container principale con padding superiore sulla safe area → `app/(app)/layout.tsx`.
* **Safe Area Bottom**: `BottomNav`, FAB e footer sticky dei form usano `env(safe-area-inset-bottom)`.

---

## Pattern di schermata (redesign)

* **Home** — hero balance (Revolut/Monzo): saldo grande con `AmountDisplay` (verde se a credito), pill direzione avatar→freccia→avatar, CTA inline "Conguaglia", riga di stat-tile. Card opache, clearance FAB (`pb-24`) → `components/HomeShell.tsx`, `components/BalanceCard.tsx`.
* **Inserimento spesa** — amount-first (Monzo/Splitwise) in `Sheet size="full"` con footer sticky per il Salva → `components/expense/ExpenseFormFields.tsx`.
* **Storico** — search pill + un'unica riga di chip (chip "Filtri" apre uno `Sheet` filtri esteso); header giorno sticky con totale del giorno (pattern N26) → `app/(app)/spese/SpeseFiltri.tsx`.
* **Dettaglio** — hero recap (`CategoryIcon` + `AmountDisplay` + badge stato) e transaction detail su `ListRow` → `app/(app)/spese/[id]/page.tsx`.
* **Conguaglio** — payment-confirm: hero saldo, righe con `Checkbox` + `CategoryIcon` (deselezione via sola opacità), barra azione solida fusa con la BottomNav, conferma in `Sheet` payment-confirm → `app/(app)/conguaglio/ConguaglioClient.tsx`.
* **Gestione casa** (`/casa`) — liste "Da fare" / "Gesti" / "Fatto di recente" su `Card` opache con `ChoreRow` (bottone "Fatto" inline, nessun dialog di conferma: non è un'azione distruttiva) e UI ottimistica identica al pattern §1 sotto; FAB apre `RegisterChoreSheet` per registrare qualsiasi faccenda del catalogo, anche fuori cadenza o retrodatata → `components/chores/ChoreShell.tsx`.
  * **Fase 2 (implementata)**: in cima alla schermata, `WeekGoalCard` mostra XP di casa verso l'obiettivo settimanale, la striscia (🔥, solo settimane *concluse* che hanno raggiunto l'obiettivo — quella in corso non vi contribuisce finché non finisce, per non far oscillare il numero a metà settimana) e la barra di equilibrio a **zona morta 30–70%**: dentro quel range nessuna percentuale, nessun nome, solo "In equilibrio questa settimana" — la zona morta ampia conta più della precisione degli XP (`docs/design-modulo-gestione-casa.md`). Nel feed, `ChoreLogRow` aggiunge una riga di 4 reazioni-emoji (kudos) sulle faccende dell'altro e un'icona cestino con `Dialog` di conferma per eliminare una propria registrazione in qualsiasi momento, non solo nella finestra del toast "Annulla".
  * **XP registrati ma non mostrati** resta vero solo per il *contenuto* del catalogo (nessun valore XP delle singole voci esposto fuori da `/casa/catalogo`, che è configurazione, non punteggio): l'obiettivo/striscia/equilibrio di fase 2 sono invece pienamente visibili, dietro l'interruttore "gamification" descritto sotto.

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
