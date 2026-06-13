# Pattern di Design e Principi di UI/UX

Questa pagina documenta i pattern architetturali grafici, i principi di design del frontend, l'integrazione di Material Design 3 e i pattern interattivi applicati a **Casa Nostra**.

---

## Integrazione Material Design 3 (M3)

L'interfaccia utente è modellata sulle linee guida di **Material Design 3**, ottimizzata per l'uso mobile-first con una sola mano.

### 1. Palette di Colori Tonale
I colori dell'applicazione sono dichiarati tramite CSS Variables in `globals.css` → `app/globals.css`. I colori principali e i riempimenti derivano da un colore di base (seed) verde-azzurro ("denaro"):
* **Light Theme**:
  * Sfondo (`--background`): `tone 98` (`#f4faf8`) → Superficie chiarissima che riduce l'affaticamento visivo.
  * Colore Primario (`--accent`): `tone 40` (`#00756d`) → Utilizzato per elementi attivi e d'impatto.
  * Contenitore Tonal (`--accent-muted`): `tone 90` (`#9cf1ec`) → Sfondo a basso contrasto per pillole ed evidenziatori.
* **Dark Theme**:
  * Sfondo (`--background`): `tone 6` (`#161d1c`) → Nero tonale molto scuro.
  * Colore Primario (`--accent`): `tone 80` (`#4ddbd2`) → Colore d'accento ad alta leggibilità in modalità scura.
  * Contenitore Tonal (`--accent-muted`): `tone 30` (`#00504b`) → Sfondo scuro tonale.

### 2. Forme e Raggi di Curvatura (Shapes & Radius)
L'applicazione rispetta rigorosamente i raggi di curvatura delle superfici di M3:
* **Pulsanti (Pill Shape)**: Tutti i bottoni usano `rounded-full` → `components/ui/Button.tsx`.
* **Card (Medium Shape)**: Raggio di curvatura impostato a `16px` (`rounded-2xl`) → `components/ui/Card.tsx`.
* **FAB (Large Shape)**: I Floating Action Button usano il raggio `rounded-2xl` (16dp) abbinato a un'elevazione personalizzata `shadow-fab` e ad un micro-feedback tattile alla pressione (`active:scale-95`) → `components/HomeShell.tsx`.
* **Dialog e Bottom Sheet (Extra-Large Shape)**: Raggio impostato a `28px` (`rounded-[28px]`) con bordi tenui → `components/ui/Dialog.tsx`.

### 3. Indicatori Attivi di Navigazione (BottomNav M3)
La barra di navigazione in basso applica il pattern M3 active indicator → `components/BottomNav.tsx#L69-L77`:
* L'elemento attivo non colora l'intera colonna del pulsante.
* Un elemento di sfondo a forma di pillola (`w-14 h-8 rounded-full bg-accent-muted`) compare dietro all'icona del tab attivo, spostandosi con un'animazione fluida (gestita da `motion.span` con `layoutId="nav-pill"`) al cambio di pagina.

---

## Tailwind CSS v4 e PostCSS

Il design system sfrutta le funzionalità introdotte da **Tailwind CSS v4** → `package.json`:
* **Configurazione CSS-First**: Non esiste un file `tailwind.config.js`. La configurazione del tema, l'importazione dei font e la dichiarazione delle utility avviene tramite la direttiva `@theme` inserita direttamente all'interno di `app/globals.css` → `app/globals.css`.
* **Integrazione**: Compilato tramite il plugin PostCSS `@tailwindcss/postcss` → `postcss.config.mjs`.

---

## Safe Area e Mobile Viewports

Per garantire una UX ottimale su dispositivi iOS e Android moderni (dotati di notch e barre di navigazione gestuali), l'applicazione implementa la gestione delle aree sicure del display:
* **Viewport Config**: La viewport è configurata con `viewportFit: 'cover'` per estendere lo sfondo a tutto lo schermo → `app/layout.tsx#L20`.
* **Safe Area Top**: L'intestazione dell'app (`AppHeader`) ed il container principale applicano un padding superiore calcolato sulla safe area per non finire sotto la barra di stato → `app/(app)/layout.tsx#L13`.
* **Safe Area Bottom**: La barra di navigazione in basso (`BottomNav`) calcola il padding inferiore tramite `pb-[env(safe-area-inset-bottom)]` per distanziare le icone dall'indicatore di sblocco di iOS/Android → `components/BottomNav.tsx#L48`.

---

## Pattern di UI Interattiva

### 1. Interfaccia Ottimistica (Optimistic UI)
Applicata nell'inserimento delle spese per azzerare i tempi di attesa percepiti dall'utente → `components/HomeShell.tsx#L42-L54`:
* Quando l'utente compila ed invia il form di una nuova spesa, l'applicazione non attende la risposta del server.
* Il componente client inserisce immediatamente la spesa in uno stato React temporaneo (`optimistic`) con un ID provvisorio e chiude la modale di inserimento.
* La lista delle ultime spese unisce le spese ottimistiche a quelle reali della pagina (`combined`).
* Al termine della Server Action (che esegue `revalidatePath`), Next.js rinfresca i dati dal DB in background; lo stato ottimistico viene ripulito e sostituito silenziosamente dalla riga persistita.

### 2. Transizioni di Pagina
Per dare un senso di fluidità tipico delle app native, le transizioni tra le rotte e il caricamento delle modale sono gestite tramite libreria di movimento `motion/react` → `components/PageTransition.tsx` ed animate sull'opacità e sulla traslazione sull'asse Y.
