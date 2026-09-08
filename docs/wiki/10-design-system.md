# 10. Regole grafiche — Design System di Casa Nostra

Riferimento completo dell'assetto visivo: colori, tipografia, layout, spaziature, componenti, animazioni e formati di visualizzazione. Descrive **quello che il codice fa oggi** (redesign "menta e crema" approvato l'8 settembre 2026), non un ideale.

Fonti di verità nel codice:

| Cosa | Dove |
| --- | --- |
| Token colore, tipografia, base CSS, keyframes | `app/globals.css` |
| Font locali e metadata/status bar | `app/layout.tsx`, `lib/theme.ts` |
| Guscio applicativo (container, header, nav, FAB) | `app/(app)/layout.tsx` |
| Preset di movimento | `lib/motion.ts` |
| Formati importi/date, palette categorie | `lib/fmt.ts` |
| Parsing importi | `lib/expense-input.ts` |
| Primitivi UI | `components/ui/` |
| Voci di navigazione | `lib/nav.ts` |
| Misure tastiera software | `lib/keyboard.ts`, `components/KeyboardInsets.tsx` |

**Regola zero:** nei componenti si usano sempre i token Tailwind (`bg-surface`, `text-muted`, `shadow-card`, …), mai hex letterali. Le uniche eccezioni ammesse sono `lib/theme.ts` (status bar / metadata Next, dove serve una stringa JS) e la palette categorica `CATEGORY_VISUAL`, che deve produrre fill per Recharts/SVG.

---

## 1. Colore

### 1.1 Come sono organizzati i token

I ruoli seguono Material Design 3, con alias storici del progetto:

| Ruolo M3 | Token progetto | Utility Tailwind |
| --- | --- | --- |
| surface | `--background` | `bg-background` |
| surface-container-lowest | `--surface` | `bg-surface` |
| surface-container | `--surface-raised` | `bg-surface-raised` |
| surface-container-high | `--surface-sunken` | `bg-surface-sunken` |
| primary | `--accent` | `bg-accent` / `text-accent` |
| on-primary | `--accent-foreground` | `text-accent-foreground` |
| primary-container | `--accent-muted` | `bg-accent-muted` |
| on-primary-container | `--accent-soft` | `text-accent-soft` |
| on-surface-variant | `--muted` | `text-muted` |
| outline-variant | `--border` | `border-border` |
| outline | `--border-strong` | `border-border-strong` |
| error | `--destructive` / `--destructive-foreground` | `bg-destructive`, `text-destructive` |

In più: `--positive` / `--positive-muted` / `--positive-soft` (saldo a credito, badge "Aperta"), oggi identici alla scala accent ma **semanticamente separati**: vanno usati quando il significato è "in positivo", non "azione primaria".

I valori dark vivono in `:root` come `--dk-*` (unica sorgente degli hex); i due blocchi dark si limitano a riassegnare i token. Non duplicare hex.

### 1.2 Palette light — "menta e crema"

| Token | Hex | Uso |
| --- | --- | --- |
| `--background` | `#f8f5ef` | fondo pagina, header |
| `--foreground` | `#203b32` | testo primario |
| `--surface` | `#fffdf8` | card, input, sheet, bottom nav |
| `--surface-raised` | `#efeee5` | hover righe, segmented control, bolla assistente |
| `--surface-sunken` | `#e7e9df` | tracce barre/anello, sfondi in secondo piano |
| `--accent` | `#176b5b` | azioni primarie, FAB, link |
| `--accent-foreground` | `#fffdf8` | testo su accent |
| `--accent-muted` | `#dceee4` | contenitori tonali, pillola nav attiva, chip |
| `--accent-soft` | `#174f40` | testo su contenitore tonale |
| `--muted` | `#5e6c63` | testo secondario, icone inattive |
| `--border` | `#e3e5d9` | bordi di card e divisori |
| `--border-strong` | `#a3ada1` | bordi di controlli (outline, chip, checkbox) |
| `--destructive` | `#ba1a1a` | errori, eliminazioni, urgenza alta |
| `--destructive-foreground` | `#fffdf8` | testo su destructive |
| `--positive` | `#176b5b` | importi/saldo in positivo |

### 1.3 Palette dark

| Token | Hex |
| --- | --- |
| `--background` | `#121b19` |
| `--foreground` | `#f4f0e8` |
| `--surface` | `#1b2925` |
| `--surface-raised` | `#25372e` |
| `--surface-sunken` | `#15211d` |
| `--accent` | `#94d5b8` |
| `--accent-foreground` | `#163c2d` |
| `--accent-muted` | `#2a493a` |
| `--accent-soft` | `#d0efde` |
| `--muted` | `#b3c2b7` |
| `--border` | `#34483c` |
| `--border-strong` | `#617969` |
| `--destructive` | `#ffb4ab` |
| `--destructive-foreground` | `#4a0805` |

In dark l'accent è **chiaro su fondo scuro**: `--accent-foreground` diventa scuro e `--accent-soft` diventa chiaro. Chi scrive un componente non se ne deve accorgere — basta usare le coppie `bg-accent` + `text-accent-foreground` e `bg-accent-muted` + `text-accent-soft` e non invertirle mai a mano.

### 1.4 Modalità chiaro/scuro

Tre stati, come il `ThemeToggle`: **Chiaro**, **Scuro**, **Sistema**.

- Sistema = nessun attributo: valgono i `--dk-*` sotto `@media (prefers-color-scheme: dark)` con guardia `:root:not([data-theme="light"])`.
- Scelta esplicita = `data-theme="light" | "dark"` sull'`<html>`, persistita in `localStorage.theme`.
- Uno script inline nel `<head>` (`themeInitScript` in `app/layout.tsx`) applica l'attributo **prima del primo paint**: niente flash di tema sbagliato. Non spostarlo in un effetto.
- La preferenza si sincronizza tra schede via evento `storage` (`ThemeToggle`), e i componenti che devono conoscere il tema in JS (grafici) usano `useDarkTheme()` (`lib/use-dark-theme.ts`), non `matchMedia` a mano.
- La status bar mobile usa `THEME_COLOR_LIGHT` / `THEME_COLOR_DARK`, che devono restare uguali a `--background` e `--dk-background`.

### 1.5 Palette categorica delle spese

`CATEGORY_VISUAL` in `lib/fmt.ts` è la **sola** fonte: due varianti hex (tema chiaro/scuro) per i grafici, più le classi `container` per il tondo dietro l'icona.

| Categoria | Light | Dark |
| --- | --- | --- |
| affitto | `#527a9c` | `#a2bfd8` |
| bolletta | `#a67c22` | `#ddba64` |
| spesa_alimentare | `#45836a` | `#9bcab3` |
| abbonamento | `#876493` | `#c3a3d0` |
| manutenzione | `#b56b4f` | `#e8ac8a` |
| viaggi | `#a6627f` | `#deabc1` |
| altro | `#777f73` | `#bec4b3` |

- Fill di un grafico: `categoryHex(category, isDark)`, con fallback su "altro" (grigio, convenzione dataviz).
- Tondo icona: `CATEGORY_COLOR` / `CATEGORY_VISUAL[...].container` — stessa tinta al 15% (20-25% in dark).
- **Il colore non è mai l'unico segnale**: ogni categoria porta sempre anche nome (`CATEGORY_LABELS`) e icona Lucide (`CategoryIcon`). Vale anche per stato spesa e direzione del saldo.
- Urgenza lista (`SHOPPING_URGENCY_CLASS`): solo `alta` è colorata (`bg-destructive/12 text-destructive`), `bassa` e `media` restano neutre. Se tutto è evidenziato, niente lo è.

---

## 2. Tipografia

### 2.1 Famiglie

Due font variabili **locali** in `app/fonts/` (WOFF2, licenza OFL): nessuna richiesta esterna in build o navigazione.

| Font | Variabile | Pesi | Utility | Uso |
| --- | --- | --- | --- | --- |
| Manrope | `--font-manrope` | 200–800 | `font-sans` (default su `body`) | interfaccia, controlli, dati densi |
| Fraunces | `--font-fraunces` | 100–900 | `font-display` | titoli di pagina, importi protagonisti, nome dell'app |

Fallback: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, …` per Manrope; `Georgia, serif` per Fraunces. Entrambi `display: swap`.

La classe `.font-display` non cambia solo la famiglia: imposta anche `font-variation-settings: "SOFT" 100, "WONK" 1` e `font-optical-sizing: auto`. Usa **sempre** `font-display`, mai `font-family` diretto.

### 2.2 Scala

Scala custom registrata in `@theme inline` (oltre alla scala Tailwind standard):

| Utility | Dimensione | Line-height | Uso |
| --- | --- | --- | --- |
| `text-display` | `clamp(2.5rem, 7vw, 3.5rem)` | 1.05 | importo protagonista (saldo a schermo intero) |
| `text-display-sm` | `clamp(2rem, 6vw, 2.75rem)` | 1.1 | importo hero nei form, totali statistiche |
| `text-title` | `1.125rem` | 1.3 | titolo di sheet, importi di riga importanti |
| `text-label` | `0.8125rem` | 1.2 | etichette di campo sopra i controlli |

Gerarchia effettivamente in uso:

- **H1 di pagina**: `font-display text-3xl font-semibold tracking-tight` (login: `text-4xl`).
- **H2 di sezione**: `text-base font-semibold` (o `text-sm font-semibold` dentro le card compatte).
- **Corpo**: `text-sm` (dominante) — `text-base` solo negli input, per non far zoomare iOS.
- **Secondario / metadati**: `text-xs text-muted`.
- **Etichette di campo**: `text-label font-medium text-muted`, oppure `text-sm font-medium text-foreground` nell'`Input` con label.
- **Pesi**: `font-semibold` è il peso "forte" standard; `font-medium` per etichette e voci di menu; `font-bold` è riservato alla landing e all'input importo.
- **Tracking**: `tracking-tight` sui titoli display; sugli importi `-0.04em` (display), `-0.03em` (display-sm), `-0.02em` (input hero), `-0.01em` (title).

`cn()` (`lib/utils.ts`) estende `tailwind-merge` con il gruppo `font-size` custom: `text-display`, `text-display-sm`, `text-title`, `text-label` si sovrascrivono correttamente con le classi Tailwind standard.

---

## 3. Layout

### 3.1 Container e breakpoint

Il guscio è in `app/(app)/layout.tsx`:

```
<main class="mx-auto w-full max-w-lg
             pt-[calc(4rem+env(safe-area-inset-top))]
             pb-[calc(4rem+env(safe-area-inset-bottom))]
             md:max-w-3xl lg:max-w-6xl lg:pl-60 lg:pb-8">
```

| Viewport | Larghezza contenuto | Navigazione |
| --- | --- | --- |
| < 768px (mobile) | `max-w-lg` (32rem) | header + barra in basso |
| ≥ 768px (`md`) | `max-w-3xl` (48rem) | header + barra in basso |
| ≥ 1024px (`lg`) | `max-w-6xl` (72rem) con `pl-60` | header + **sidebar**, barra in basso nascosta |

- Il padding verticale del `<main>` compensa header (4rem) e barra in basso (4rem) **più** le safe area: le pagine non devono ri-aggiungerlo.
- Larghezza massima dell'app: **72rem**, valore ripetuto in `.app-fab` e nella sidebar per allineare gli elementi flottanti al container.
- Breakpoint effettivamente usati, in ordine di frequenza: `sm:` (landing), `lg:` (desktop shell), `md:`, `xl:` (griglie a due colonne di home e statistiche). Non introdurne altri senza motivo.

### 3.2 Padding e ritmo verticale delle pagine

Ogni pagina si porta il proprio padding orizzontale. Schema standard:

```
<div class="flex flex-col gap-5 px-4 pt-6 pb-4">      <!-- pagina normale -->
<div class="flex flex-col gap-6 px-4 pt-6 pb-24">     <!-- pagina con FAB -->
```

- **Orizzontale: sempre `px-4`.** Le card e le righe hanno il proprio `px-4`/`px-5` interno.
- **Alto: `pt-6`** (`pt-4` in home, che ha il saluto).
- **Basso: `pb-4`**, oppure **`pb-24` / `pb-8`** dove il FAB coprirebbe l'ultima riga.
- **Gap fra blocchi: `gap-4` o `gap-5`**; `gap-6` nelle pagine più aeree. Fra elementi interni: `gap-2` e `gap-3` sono la norma, `gap-1.5` per etichetta+campo.
- Griglie a due colonne solo da `xl:` in su (`xl:grid-cols-[1fr_1.3fr]` in home, `xl:grid-cols-2` in statistiche), con `items-start`.

### 3.3 Elementi fissi e z-index

| Livello | Elemento |
| --- | --- |
| `z-[100]` | skip link "Vai al contenuto" (visibile solo al focus) |
| `z-50` | overlay + contenuto di `Sheet`, `Dialog`, `AttachmentLightbox` |
| `z-40` | header, barra in basso |
| `z-30` | FAB, indicatore pull-to-refresh |
| `z-20` / `z-10` | sovrapposizioni locali dentro un componente |

Geometria degli elementi fissi:

- **Header**: `fixed top-0 inset-x-0 h-16`, contenuto in `max-w-6xl px-4`, `bg-background/95 backdrop-blur-md`, `border-b border-border`, `pt-[env(safe-area-inset-top)]`.
- **Barra in basso**: `fixed bottom-0 h-16`, lista in `max-w-lg px-2`, `bg-surface/95 backdrop-blur-md`, `border-t`, `shadow-nav`, `pb-[env(safe-area-inset-bottom)]`, `lg:hidden`, classe `hide-on-keyboard`.
- **Sidebar desktop**: `fixed top-24 bottom-6 left-[max(1.5rem,calc((100vw-72rem)/2+1rem))] w-52 hidden lg:flex`, con `ThemeToggle` in fondo (`mt-auto`).
- **FAB**: `fixed bottom-[calc(5rem+env(safe-area-inset-bottom))]`, orizzontale via `.app-fab` (`right: max(1rem, calc((100vw - 72rem)/2 + 1rem))`), `size-14 rounded-full bg-accent shadow-fab`, `hide-on-keyboard`. **Una sola FAB per schermata**, ed è "Nuova spesa" in home.

> Nota: `app/globals.css` definisce ancora l'utility `.glass` (`--glass-bg` / `--glass-blur`) per header e barra in basso, ma i due componenti oggi usano `bg-*/95 backdrop-blur-md`. Se ritocchi il vetro, allinea i due punti o rimuovi l'utility.

### 3.4 Safe area e tastiera software

Mai `env(safe-area-inset-bottom)` da solo negli elementi in fondo: usa le variabili aggiornate da `<KeyboardInsets>`.

| Variabile | Significato |
| --- | --- |
| `--keyboard-height` | spazio rubato dalla tastiera → **si sottrae alle altezze** |
| `--keyboard-inset` | dove appoggiare un `fixed` → **valore di `bottom`** |
| `--safe-bottom` | safe area di fondo; diventa `0px` a tastiera aperta |

- I due numeri divergono quando iOS spinge su l'intera pagina (`lib/keyboard.ts`): usarne uno solo manda la testa della sheet fuori schermo. Soglia minima 120px per non confondere la barra indirizzi con una tastiera.
- `:root[data-keyboard="open"] .hide-on-keyboard { display: none }` — FAB e barra in basso spariscono mentre si scrive.
- `viewport.interactiveWidget = 'resizes-content'` gestisce Android; iOS lo ignora e viene coperto da `KeyboardInsets`.
- `viewportFit: 'cover'` è obbligatorio perché le safe area abbiano un valore.

---

## 4. Forma: raggi, bordi, ombre

### 4.1 Raggi

| Raggio | Dove |
| --- | --- |
| `rounded-full` | bottoni, chip, badge, FAB, avatar, pillola nav, barre di avanzamento |
| `rounded-3xl` (24px) | **card** (`Card`), riquadro login |
| `rounded-[28px]` | `Sheet` (solo in alto: `rounded-t-[28px]`) e `Dialog` |
| `rounded-2xl` (16px) | input, textarea, segmented control, voci di menu, contenitori tonali, `CategoryIcon` md/lg |
| `rounded-xl` (12px) | segmenti interni, skeleton, `CategoryIcon` sm, bottone hamburger |
| `rounded-md` | checkbox, coda delle bolle chat (`rounded-br-md` / `rounded-bl-md`) |

Non introdurre raggi nuovi: la scala è deliberatamente corta.

### 4.2 Bordi

- Superfici e divisori: `border-border` (`divide-y divide-border` nelle liste dentro card).
- Controlli con contorno (outline button, chip, checkbox): `border-border-strong`.
- Sheet e Dialog usano `border-border/60`, un filo più tenue.
- Bordo di errore: `border-destructive`.

### 4.3 Ombre

Scala piatta, da fintech: la profondità la fanno **bordo + contrasto di superficie**, non l'ombra.

| Token | Uso |
| --- | --- |
| `shadow-soft` | input, segmento attivo, tessere leggere |
| `shadow-card` | card, toast, indicatore pull-to-refresh |
| `shadow-fab` | solo il FAB (ha un alone di accent) |
| `shadow-dialog` | sheet, dialog, lightbox |
| `shadow-nav` | barra in basso (ombra verso l'alto) |

In dark le ombre si appiattiscono ulteriormente (`--dk-shadow-card` è una sola ombra a 1px): al buio la separazione la fa il colore della superficie.

---

## 5. Componenti

### 5.1 Button (`components/ui/Button.tsx`)

Tutti i bottoni sono **a pillola** (`rounded-full`).

| Size | Altezza | Padding | Testo |
| --- | --- | --- | --- |
| `sm` | `min-h-11` (44px) | `px-4` | `text-sm` |
| `md` (default) | `min-h-12` (48px) | `px-5` | `text-base` |
| `lg` | `h-13` (52px) | `px-6` | `text-base font-semibold` |

| Variant | Stile |
| --- | --- |
| `primary` | `bg-accent text-accent-foreground` |
| `secondary` | `bg-accent-muted text-accent-soft` |
| `outline` | `border-border-strong` su trasparente |
| `ghost` | solo testo, hover `bg-surface-raised` |
| `destructive` | `bg-destructive text-destructive-foreground` |

Regole di stato:

- **Hover per miscelazione, non per opacità**: `color-mix(in oklab, var(--accent), #000 8%)`; `14%` in `:active`. L'opacità sul look piatto risultava slavata.
- `active:scale-[0.98]`, transizione `150ms` su `transform, background-color, border-color, color`.
- `disabled`: `opacity-50`, `cursor-not-allowed`, niente scale.
- `loading`: i figli diventano `invisible` (la larghezza non cambia, il bottone non "salta"), lo `Spinner` va in overlay assoluto, `disabled` e `aria-busy` sono automatici.
- Focus: `ring-2 ring-accent ring-offset-2 ring-offset-background`.
- `buttonVariants` è esportato per stilare un `<Link>` come bottone (`CtaLink` della landing).

### 5.2 Card (`components/ui/Card.tsx`)

`rounded-3xl border border-border shadow-card`, **opaca** — le vecchie card semi-trasparenti con blur sono state eliminate. Toni: `default` (`bg-surface`), `raised`, `sunken`.
Sottocomponenti: `CardHeader` (`px-4 pt-4 pb-2`), `CardContent` (`px-4 py-3`), `CardFooter` (`px-4 pb-4 pt-2`). Per una card che contiene una lista: `p-0 overflow-hidden divide-y divide-border`.

### 5.3 Input, AmountInput, textarea

- **`Input`**: `h-12 rounded-2xl border-border bg-surface px-4 text-base shadow-soft`; focus `ring-2 ring-accent border-transparent`; errore `border-destructive` + `<p class="text-xs text-destructive">` collegato via `aria-describedby`. `text-base` è obbligatorio: sotto i 16px iOS zooma al focus.
- **`AmountInput` `size="hero"`**: box `h-20`, contenuto centrato, `€` in `text-display-sm text-muted` a sinistra, valore in `font-display text-display-sm font-bold tabular-nums`. `inputMode="decimal"`, `type="text"` (mai `type="number"`: niente virgola italiana, niente spinner).
- **`AmountInput` `size="md"`**: `h-12`, `text-xl`, per gli importi secondari (quota personalizzata).
- **Textarea assistente**: `rounded-2xl border-border bg-surface px-3 py-3 text-base min-h-12 resize-none`, `enterKeyHint="send"`, Invio invia e Shift+Invio va a capo.
- Il campo da mettere a fuoco all'apertura di una sheet si marca con `data-autofocus` (vedi §5.7), **non** con `autoFocus`.

### 5.4 Chip, SegmentedControl, Badge, Checkbox, Avatar

- **`Chip`**: `min-h-11 rounded-full px-3.5 py-2 text-sm font-medium`, `active:scale-[0.97]`. Attivo → `bg-accent text-accent-foreground` con `aria-pressed`; inattivo → `border-border-strong text-muted`. Variante `suggestion` = sempre nello stato inattivo (è un'azione, non un filtro). Le file di chip scorrono in orizzontale con `-mx-4 overflow-x-auto no-scrollbar` + `px-4`.
- **`SegmentedControl`**: contenitore `rounded-2xl bg-surface-raised p-1`; segmenti `min-h-11 flex-1 rounded-xl text-sm font-semibold`; selezionato `bg-surface text-accent shadow-soft`. `role="group"` + `aria-pressed`.
- **`Badge`**: `px-2 py-0.5 rounded-full text-xs font-medium`. Varianti `default`, `accent`, `success`, `positive`, `destructive` (`bg-destructive/12`), `muted`, `outline`. Convenzione: spesa **Aperta** → `positive`, **Saldata** → `muted`.
- **`Checkbox`**: wrapper `size-11` (target tattile) con box visivo di 22px, `rounded-md border-2 border-border-strong`, `checked:bg-accent`; la spunta è un'icona Lucide in overlay con `peer-checked:opacity-100`.
- **`Avatar`**: cerchio `size-9 text-xs` (o `sm`: `size-7 text-[10px]`) con iniziali da `initialsOf()`; `highlighted` → `bg-accent text-accent-foreground` per "questo sei tu".

### 5.5 ListRow ed ExpenseRow

`ListRow` è la riga standard: `flex items-center gap-3 px-4 py-3`, titolo `text-sm font-semibold line-clamp-2 break-words`, sottotitolo `mt-1 text-xs text-muted`, trailing allineato a destra e `shrink-0`. Interattiva → `hover:bg-surface-raised active:bg-border`. Rende `<Link>` se c'è `href`, `<button>` se c'è `onClick`, altrimenti un `<div>`.

`ExpenseRow` la specializza: `leading` = `CategoryIcon` md, sottotitolo `"Pagante · Categoria · Divisione"` separato da `·`, trailing = importo `text-sm font-semibold tabular-nums` + data breve + badge di stato, incolonnati con `gap-0.5`.

### 5.6 Icone

**Lucide** (`lucide-react`) ovunque nell'interfaccia. Dimensioni: `size-4` (inline nel testo), `size-5` (standard in righe e nav), `size-6` (header, FAB). `strokeWidth`: `1.8` di default nelle icone categoria, `2.4–2.5` per l'enfasi (voce di nav attiva, FAB, spunta).
Le emoji di `CATEGORY_ICON` / `SHOPPING_CATEGORY_ICON` restano per i canali testuali (Telegram, assistente): nell'app si usa `CategoryIcon`/`ShoppingIcon`. Le icone decorative sono sempre `aria-hidden`.

### 5.7 Sheet (`components/ui/Sheet.tsx`)

Bottom sheet Radix, è **il** contenitore di form e flussi (nuova spesa, modifica, menu, assistente, controllo scontrino).

- Overlay `bg-black/50 backdrop-blur-sm` con fade.
- Contenuto: `fixed inset-x-0 bottom-[var(--keyboard-inset)] mx-auto max-w-xl rounded-t-[28px] bg-surface shadow-dialog`, entrata `slide-in-from-bottom` in **300ms**.
- Altezza: `size="auto"` → `max-h-[calc(92svh - var(--keyboard-height))]`; `size="full"` → `h-[calc(100svh - 0.75rem - var(--keyboard-height))]`.
- Header fisso: drag handle `h-1.5 w-12 rounded-full bg-border-strong`, titolo `text-title font-semibold`, descrizione `text-sm text-muted`, chiusura `size-11` in alto a destra (il titolo ha `pr-16` per non finirci sotto).
- Corpo scrollabile `min-h-0 flex-1 overflow-y-auto`; footer opzionale fisso con `pb-[max(0.75rem, var(--safe-bottom))]`.
- **Focus**: il fuoco iniziale va sul contenitore; il campo `[data-autofocus]` viene messo a fuoco **340ms dopo** (`OPEN_FOCUS_DELAY`), a fine animazione. Anticiparlo fa "volare su" la pagina su iOS.

### 5.8 Dialog (`components/ui/Dialog.tsx`)

Solo per le **conferme**, mai per i form: `max-w-sm w-[calc(100%-2rem)]` centrato, `rounded-[28px]`, entrata `fade + zoom-in-95` in 200ms. Corpo `p-6`, titolo `text-lg font-semibold`, descrizione `mt-2 text-sm text-muted`; footer separato da bordo con due bottoni `flex-1` — **Annulla** (`secondary`) a sinistra, conferma a destra (`destructive` se distrugge). Durante `loading` sono bloccati Esc e click fuori.

Richiedono conferma per requisito: eliminazione di una spesa, conferma di un conguaglio, eliminazione di un articolo della lista, svuotamento dello storico. **Non** la richiedono: aggiunta alla lista e spunta di un articolo (si annullano da toast).

### 5.9 Feedback: toast, skeleton, spinner, progress

- **Toast** (`sonner`, `lib/toast.tsx`): `position="top-center"`, `offset 16`, `duration 3500`, `richColors`, `closeButton`; stile `rounded-2xl border border-border bg-surface shadow-card`. Le conferme post-redirect passano da `?ok=<chiave>` e dalla mappa messaggi di `FlashToast`, che poi ripulisce l'URL.
- **Skeleton**: `.shimmer` — gradiente `surface-raised → surface-sunken → surface-raised`, `background-size: 200%`, animazione `1.6s ease-in-out infinite`; forma `rounded-xl`. Ogni rotta ha il suo `loading.tsx` che **ricalca la struttura reale** (stesse altezze e stesso numero di righe), così non c'è salto di layout.
- **Spinner**: SVG `animate-spin`, `size-4/5/6`, `currentColor`.
- **Barra di caricamento di navigazione**: `NextTopLoader` alto 2px, colore `var(--accent)`, senza spinner.
- **Regola**: ogni salvataggio, eliminazione o conguaglio dà feedback immediato (bottone in `loading`, poi toast).

---

## 6. Navigazione

- **Menu hamburger** (in alto a sinistra) = mappa completa dell'app: `NAV_PRIMARY` + separatore + `NAV_SECONDARY` + selettore tema. Voci: `rounded-2xl px-3 py-2.5`, icona `size-5`, label `text-sm font-medium`, descrizione `text-xs text-muted`, chevron a destra; attiva → `bg-accent-muted` con testo `accent-soft` e `aria-current="page"`.
- **Barra in basso** = solo Home, Storico, Lista (`BOTTOM_NAV_HREFS`). Riflette la frequenza d'uso, non la mappa: **non cresce** quando arriva una schermata nuova. Etichette corte da `BOTTOM_NAV_LABELS`.
- **Indicatore attivo M3**: pillola `bg-accent-muted` `h-8 w-14` dietro la **sola icona**, spostata con `layoutId="nav-pill"` e `springLayout`; l'icona attiva fa `scale 1.05` e passa a `strokeWidth 2.4`.
- **Desktop (`lg:`)**: sidebar laterale con tutte le voci, `min-h-12 rounded-2xl px-4`, attiva `bg-accent-muted text-accent-soft`; la barra in basso sparisce.
- Aggiungere una schermata = aggiungere una voce in `lib/nav.ts`. La voce attiva si calcola con `activeNavHref()` (prefisso più lungo che combacia), non con confronti sparsi.
- Nell'header, a destra, c'è il pulsante **Assistente** (`bg-accent-muted`, `rounded-full`, `min-h-11`); l'etichetta compare da `sm:` in su.

---

## 7. Movimento e animazioni

### 7.1 Preset (`lib/motion.ts`)

| Preset | Valori | Uso |
| --- | --- | --- |
| `springSnappy` | stiffness 400, damping 30 | toggle, tap, comparsa del FAB |
| `springSoft` | stiffness 260, damping 26 | entrata/uscita di card e contenuti |
| `springLayout` | stiffness 320, damping 28 | indicatori con `layoutId` (pillola nav) |
| `durationFast` | `0.18s` | transizioni non-spring (opacità, colore) |

Non ridefinire spring nei componenti: se serve un feeling nuovo, si aggiunge un preset qui.

### 7.2 Durate CSS

`duration-150` per gli stati dei controlli (hover/active/focus/colore), `duration-200` per il Dialog, `duration-300` per la Sheet. `transition-colors` per i cambi di sola tinta; sui bottoni si elencano le proprietà (`transition-[transform,background-color,border-color,color]`) invece di `transition-all`.

### 7.3 Animazioni ricorrenti

- **Transizione di pagina** (`PageTransition`): `opacity 0→1` con `y: 6 → 0`, uscita `y: -4`, `0.18s easeOut`, `AnimatePresence mode="wait"` con chiave sul pathname.
- **Comparsa del FAB**: `scale 0 → 1` con `springSnappy` e `delay 0.1`; `whileTap: scale 0.92`.
- **Sheet**: `slide-in-from-bottom` 300ms; **Dialog**: `fade` + `zoom-in-95` 200ms; overlay in fade (utility di `tw-animate-css` via `data-[state=open|closed]`).
- **Righe di lista**: `AnimatePresence` con `initial={false}` (nessuna animazione al primo render) ed uscita in sola opacità, `0.2s`.
- **Pull-to-refresh** (`PullToRefresh`): solo su `pointer: coarse`; trascinamento smorzato al 50%, soglia **70px**, corsa massima **110px**, rilascio con spring 320/30; l'icona ruota fino a 270° in proporzione al progresso e poi va in `animate-spin`. Non intercetta il gesto dentro uno scroller orizzontale (chip filtri).
- **Landing** (`Reveal`): entrata in viewport `opacity + y: 16`, spring 220/26, `once: true`, `margin: -80px`.
- **Shimmer**: unico keyframe globale dichiarato in `globals.css`.

### 7.4 Movimento ridotto — non negoziabile

Due presidi, entrambi obbligatori:

1. `<MotionConfig reducedMotion="user">` avvolge tutta l'app (`MotionProvider`).
2. In `globals.css`, `@media (prefers-reduced-motion: reduce)` azzera durate, iterazioni e `scroll-behavior` con `!important`.

Nessuna animazione deve trasportare informazione: se sparisce, la schermata resta comprensibile.

---

## 8. Regole di visualizzazione degli importi

### 8.1 Formato

- **Sempre** `formatEur()` → `Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })`: due decimali, virgola come separatore decimale, punto per le migliaia, simbolo € **dopo** il numero (`1.234,50 €`). Mai concatenare `€` a mano, mai `toFixed(2)` in un testo mostrato.
- **Cifre tabulari obbligatorie** su ogni importo: classe `tabular-nums` (o attributo `data-tabular`), definite globalmente in `globals.css`. Servono a incolonnare le liste e a evitare che un numero "balli" mentre cambia.
- Il componente da usare è **`AmountDisplay`** (`value`, `size`, `tone`, `showSign`), che applica insieme font, dimensione, tracking, tono e tabular-nums.

| `size` | Resa |
| --- | --- |
| `display` | `font-display text-display font-semibold tracking-[-0.04em]` |
| `display-sm` | `font-display text-display-sm font-semibold tracking-[-0.03em]` |
| `title` | `text-title font-semibold tracking-[-0.01em]` |

| `tone` | Colore | Quando |
| --- | --- | --- |
| `neutral` | `text-foreground` | importo di una spesa, totale |
| `positive` | `text-positive` | credito, contributo a proprio favore |
| `negative` | `text-destructive` | debito |

`showSign` antepone il `+` ai valori positivi (il `−` arriva già dalla formattazione). Si usa dove il segno è l'informazione: contributi per categoria, delta percentuali.

### 8.2 Gerarchia degli importi

| Contesto | Resa |
| --- | --- |
| Saldo al centro dell'anello (home) | scala responsive, vedi sotto |
| Importo hero del form | `font-display text-display-sm font-bold`, centrato, con `€` a sinistra |
| Totale di statistiche | `font-display text-display-sm font-semibold tabular-nums` |
| Importo di riga (storico, home) | `text-sm font-semibold tabular-nums` |
| Importo in una tabella | `text-right tabular-nums` |

**Importi lunghi.** Il saldo al centro dell'anello rimpicciolisce a scalini per non traboccare dal cerchio: `text-[1.65rem]` sotto 1.000 €, `text-[1.2rem]` da 1.000, `text-[1rem]` da 10.000, `text-[.8rem]` da 1.000.000, con `whitespace-nowrap` e `max-w-full`. Ogni nuovo contenitore stretto per un importo va provato con importi a sei cifre e nomi lunghi (fa parte della QA visiva).

### 8.3 Input di un importo

`parseEuroInput()` (`lib/expense-input.ts`) è l'unico parser, condiviso fra form e Server Action:

- accetta `€` iniziale o finale e spazi; accetta virgola **o** punto come separatore decimale; accetta i separatori di migliaia italiani (`1.234,56`);
- massimo due decimali; deve essere `> 0` e `≤ 99.999.999,99`; altrimenti `null`.
- Sull'input: `inputMode="decimal"` e `type="text"`.

La validazione lato form serve alla UX (feedback immediato, niente submit che falliscono al round-trip): i vincoli veri restano `CHECK` e RLS sul database.

### 8.4 Aritmetica

Tutte le somme di presentazione si fanno **in centesimi interi** (`Math.round(x * 100)`, divisione per 100 alla fine): vedi `categoryTotals`, `selectionContribution`, l'anello. Mai sommare float in euro.
Il saldo non si ricalcola mai lato client: arriva da `v_user_open_balance`; `describeBalance()` si limita a tradurlo in una frase, con soglia `EPSILON = 0.005` sotto la quale si è "in pari".

### 8.5 Date

| Funzione | Resa |
| --- | --- |
| `formatDate` | `8 settembre 2026` (it-IT, esteso) |
| `formatDateShort` | `8 set` (liste e righe) |
| `formatBoughtWhen` | `oggi` / `ieri` / data breve |
| `romeDateKey` / `todayISO` | chiave `YYYY-MM-DD` |

Fuso di riferimento **sempre `Europe/Rome`**, anche per il calcolo dei periodi delle statistiche. Nessuna libreria di date: solo `Intl` e `toLocaleDateString('sv-SE')` per le chiavi.

### 8.6 Testi e separatori

Tutta l'interfaccia è **in italiano**, con apostrofo tipografico (`’`) ed entità corrette. Nei sottotitoli i metadati si separano con `·` (`Pagante · Categoria · Divisione`). Etichette canoniche in `lib/fmt.ts`: `CATEGORY_LABELS`, `SPLIT_LABELS` (`50 / 50`, `60 / 40`, `Personalizzato`, con le varianti compatte `50/50`, `60/40`, `Personalizza` per il segmented control), `SHOPPING_*`. Niente stringhe di categoria scritte a mano.

---

## 9. Grafici

- **Anello (`SpendingRing`)**: SVG `viewBox 0 0 200 200` ruotato di −90°, raggio 89, `pathLength="100"` così le quote si esprimono direttamente in percentuale; traccia di fondo `var(--surface-sunken)`, spessore 11 (15 sul segmento selezionato), micro-gap fra settori. Compatto `max-w-[11.5rem]` con contenuto in `inset-6`; esteso `max-w-[17rem]` con `inset-9`, legenda selezionabile anche da tastiera (`aria-pressed`) e riquadro di dettaglio in `aria-live="polite"`.
  **I settori sono gli importi lordi per categoria, il numero al centro è il saldo netto**: sono due grandezze diverse e non vanno sommate né confuse. Il `<title>` dell'SVG elenca gli importi per chi non vede il grafico.
- **Barre mensili (statistiche)**: contenitore `h-44`, barra `w-3/4 rounded-t-md bg-accent/70`, altezza proporzionale con minimo 2px per il mese vuoto; sotto, un `<details>` con la **tabella equivalente** e i link ai movimenti. Un grafico non è mai l'unico modo di leggere il dato.
- **Barre di categoria / contributo**: `h-1.5 rounded-full` su traccia `bg-surface-sunken`, riempimento con `categoryHex()` o `bg-accent`, larghezza minima 2% perché una quota piccola resti visibile.
- I colori dei grafici arrivano da `categoryHex(category, useDarkTheme())`: cambiano con il tema, e ogni serie porta anche etichetta e valore.

---

## 10. Accessibilità

- **Target tattili**: minimo 44px (`min-h-11`), tipicamente 48px (`min-h-12`). Vale anche per i link testuali che si tappano spesso ("Vedi tutte", "Apri spese"): hanno `min-h-11` o `min-h-12`.
- **Focus**: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px }` globale; i bottoni usano l'anello con offset sul background. Non rimuovere mai l'outline senza sostituirlo.
- `-webkit-tap-highlight-color: transparent` su bottoni, link, input e `summary`: il feedback lo dà `active:scale`.
- **Skip link** "Vai al contenuto" come primo elemento del layout applicativo, visibile solo al focus (`z-[100]`).
- Stato dei controlli comunicato con `aria-pressed` (chip, segmenti, legenda), `aria-current="page"` (nav), `aria-busy` (bottoni in caricamento), `role="group"` + `aria-label` sui gruppi.
- Errori di campo collegati con `aria-invalid` + `aria-describedby`; i messaggi importanti hanno `role="alert"`, i contenuti che cambiano da soli `aria-live="polite"`.
- Icone decorative `aria-hidden`; ogni bottone di sola icona ha `aria-label`.
- `::selection` usa `accent-muted` su `accent-soft`.
- Il colore non è mai l'unico veicolo di informazione (categoria, stato, urgenza, direzione del saldo hanno sempre testo o icona).

---

## 11. Checklist di QA visiva

Prima di chiudere una modifica grafica, verifica:

1. **Larghezze**: 320, 390, 768 e 1440 px.
2. **Temi**: chiaro, scuro e "sistema" (con lo switch del SO durante la sessione).
3. **Importi lunghi** (sei cifre) e **nomi lunghi** nelle card e nelle righe.
4. **Tastiera aperta** su iOS e Android: header della sheet visibile, footer sopra la tastiera, FAB e barra in basso nascosti.
5. **Safe area**: notch e home indicator (`viewportFit: cover`).
6. **Focus da tastiera** su tutto il flusso, e `prefers-reduced-motion: reduce` attivo.
7. **Stati**: vuoto, in caricamento (skeleton della rotta), errore, disabilitato.

Comandi: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.

---

## 12. Cose da NON fare

- Non scrivere hex nei componenti: usa i token. Gli unici hex ammessi stanno in `globals.css`, `lib/theme.ts` e `CATEGORY_VISUAL`.
- Non definire un colore **solo** dentro un blocco dark: ogni token esiste in `:root` e viene riassegnato.
- Non aggiungere raggi, ombre o durate fuori dalle scale di §4 e §7.
- Non usare `transition-all`: elenca le proprietà.
- Non usare l'opacità per l'hover dei bottoni pieni: si usa `color-mix`.
- Non mettere un `text-sm` in un `<input>`: sotto 16px iOS zooma. Gli input sono `text-base`.
- Non usare `type="number"` per gli importi, e non formattare un importo senza `formatEur` + `tabular-nums`.
- Non ricalcolare il saldo lato client (`v_user_open_balance`) e non sommare euro in virgola mobile.
- Non usare `env(safe-area-inset-bottom)` da solo negli elementi fissi in fondo: ci sono `--safe-bottom` e `--keyboard-inset`.
- Non usare `autoFocus` dentro una `Sheet`: c'è `data-autofocus`.
- Non aggiungere voci alla barra in basso: le schermate nuove entrano nel menu (`lib/nav.ts`).
- Non aggiungere una seconda FAB in una schermata.
- Non introdurre una libreria di componenti o di date: bastano Tailwind, Radix (dialog/popover/tabs), Lucide, Motion, Recharts e `Intl`.
- Non reintrodurre il modulo Casa, deprecato, né richiami ad esso.
