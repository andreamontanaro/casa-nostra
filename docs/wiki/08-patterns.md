# Pattern di design e UI/UX

Aggiornamento del redesign approvato l’8 settembre 2026. Il modulo **Casa è deprecato**: non appartiene alla navigazione o alle schermate attive. I documenti storici sulle faccende restano un archivio.

## Identità visiva

- **Menta e crema**: sfondo #f8f5ef, testo #203b32, superficie #fffdf8, accento #176b5b, contenitore #dceee4. Dark mode con fondo #121b19, testo #f4f0e8 e accento #94d5b8.
- Token condivisi in `app/globals.css`; valori della barra di sistema in `lib/theme.ts`. Tema automatico, chiaro o scuro con preferenza persistita.
- **Manrope** per testi, controlli e dati densi. **Fraunces** per titoli e importi principali, con numeri tabulari dove serve confrontare cifre. Font WOFF2 locali in `app/fonts`, licenze OFL allegate; nessun download durante la build.
- Card opache, bordi delicati, raggi 24 px; pulsanti e FAB arrotondati. Una tinta principale per le azioni e palette categorica condivisa in `CATEGORY_VISUAL`.
- Icone Lucide coerenti per le spese. Colore accompagnato da nome e icona; non è l’unico segnale per categoria, stato o direzione del saldo.

## Navigazione e densità

- Barra inferiore mobile: **Home, Storico, Lista**. Menu completo: anche Statistiche e Regola il saldo, più Impostazioni.
- Desktop: navigazione laterale, area centrale più ampia e layout a colonne dove aiuta a leggere.
- Assistente nell’header; una sola FAB per aggiungere spese in home. Su richiesta sono state rimosse la CTA superiore “Aggiungi spesa” e la scorciatoia dalla home alla lista.
- Priorità ai movimenti: storico con pannello “Filtri e ricerca” inizialmente chiuso e totale compatto. Home con anello compatto e pannello “Categorie e dettagli del saldo” chiuso.
- Nessun richiamo al modulo Casa. Voci e corrispondenza della rotta attiva in `lib/nav.ts`.

## Home e conguaglio

`BalanceCard` legge il saldo ufficiale da `v_user_open_balance`. Il grafico `SpendingRing` usa le spese aperte: i settori sono proporzionali agli **importi lordi per categoria**, mentre il numero centrale è il **saldo netto**. I due dati non devono essere sommati o confusi. Le compensazioni mantengono visibili le categorie.

Quando il saldo non è a zero, sotto l'anello c'è il suggerimento «chi paga la prossima» (l'idea è di Settle Up): chi deve soldi può rientrare pagando le spese seguenti invece di fare un bonifico. Legge solo il segno di `net_position`, non stima importi; sparisce quando si è in pari. Lo scheletro della home ha la sua riga, perché è il caso normale.

L’anello compatto della home ha un testo alternativo con gli importi; il pannello espandibile mostra quote, anticipi, importi delle categorie e contributi al saldo con collegamenti allo storico. L’anello del conguaglio offre una legenda selezionabile anche da tastiera.

All'apertura la home si compone nell'ordine in cui si legge — saluto, card del saldo, titolo della sezione, poi le spese una dopo l'altra — e l'anello si disegna una fetta alla volta in senso orario. Sono animazioni CSS (`.reveal-up` e `.ring-draw` in `app/globals.css`, scala dei ritardi in `lib/motion.ts`), non `motion`: un'entrata in JS serializza `opacity: 0` nell'HTML e lascerebbe la pagina invisibile fino all'idratazione — è la ragione per cui `PageTransition` monta con `initial={false}`. Il passo è di 60 ms e l'ultima riga arriva entro i 400 ms. Il benvenuto è solo della home: `SpendingRing` disegna l'anello solo con `reveal`, e il conguaglio — dove si arriva per fare qualcosa — lo mostra completo al primo fotogramma.

Il conguaglio completo usa il saldo della vista. La selezione parziale è un’anteprima della somma in centesimi dei contributi ottenuti da `v_expense_shares`; la RPC `register_settlement` con `p_expense_ids` ricalcola e registra atomicamente. Selezione vuota e saldo compensato sono stati distinti. La conferma chiede che il bonifico sia già stato eseguito e offre un campo **nota facoltativo** (fino a 200 caratteri) che resta nello storico accanto al conguaglio e finisce nel messaggio Telegram; un riepilogo cambiato mentre la conferma è aperta richiede una nuova verifica.

## Spese

- Importo prominente con tastiera decimale, parsing condiviso tra form e Server Actions (`lib/expense-input.ts`).
- Categorie in griglia con etichette intere, divisione modificabile e anteprima nominativa delle quote. I default di dominio già presenti restano invariati.
- Bozza recuperabile esplicitamente da sessionStorage per utente. Dopo un errore i campi restano nel form.
- Salvataggio senza riga fittizia nella lista. Gli allegati vengono caricati sull’id restituito; i tentativi successivi caricano soltanto i file mancanti. La sheet di inserimento resta aperta durante il salvataggio e si sblocca dopo l’esito.
- **Effetto sul saldo in ogni riga** (il «hai prestato / devi» di Splitwise). Su una spesa aperta `ExpenseRow` mostra «+7,20 € per te» o «−4,80 € per te» al posto del badge "Aperta", che era lo stato di quasi tutte le righe recenti e non diceva niente; le saldate tengono il badge "Saldata", perché non pesano più sul saldo. Il valore è anticipato meno quota da `v_expense_shares` (vedi `05-data-access.md`); segno e parole portano il significato, il colore (verde a favore, neutro a carico) lo accompagna. Per i lettori di schermo c'è una frase intera («Aperta, 7,20 € a tuo favore»). A 320 px il badge allarga la colonna di destra e le descrizioni lunghe vanno a capo: leggibile, ma è il punto più stretto.
- **Conguagli nello storico**: ogni conguaglio è una riga al suo posto nel tempo (`SettlementRow`), fuori dalle card delle spese e con bordo tratteggiato: chi ha versato a chi, quante spese ha chiuso, la nota. Dentro un giorno conta l'ora, quindi le spese inserite prima del conguaglio stanno sotto la sua riga e quelle arrivate dopo sopra. Seguono i filtri dove hanno senso (spariscono con "Aperte" o con una categoria; la ricerca li trova per nota, o scrivendo «cong…») e non entrano nei totali, che contano solo spese. Un tap sulla riga apre `/spese?conguaglio=<id>`: solo le spese che ha chiuso.
- Storico: mese libero, stato, categoria e ricerca nell’URL; intervalli `da/a` dai grafici. Il campo di ricerca ha uno stato locale (l'URL si aggiorna in una transizione e un campo controllato da lì perdeva lettere) e il filtro usa `useDeferredValue`.
- Dettaglio in consultazione e modifica esplicita in sheet. In fondo, chi ha inserito la spesa e quando, e la data dell'ultima modifica se c'è stata («Aggiunta da Giulia il 20 settembre 2026 alle 11:08 · modificata il …»). Un conguaglio aggiorna `updated_at` delle spese che chiude: nella stessa transazione della RPC, quindi coincide al microsecondo con `settled_at` e in quel caso non si mostra come modifica. Non c'è una colonna `updated_by`: di una modifica si dice quando, non chi. Una spesa saldata ha anche la sezione "Conguaglio", con il link alle spese chiuse insieme a lei. Il ritorno porta dove si era partiti: la home (`ritorno=/`) o lo storico con i suoi filtri. Salvare una modifica chiude la sheet e resta sul dettaglio aggiornato; eliminare torna alla schermata di partenza.
- I suggerimenti di descrizione sono "come l'ultima volta": compilano anche categoria e divisione (una divisione personalizzata non si ricopia).
- Le righe delle spese precaricano il dettaglio solo all'intenzione (puntatore, dito o fuoco: `IntentLink`), non appena entrano nello schermo.
- Spese saldate in consultazione. Eliminazioni con conferma.

## Lista e scontrini

Barra rapida: una riga sola, da cui Gemini ricava nome, quantità e categoria (ripiego su Cibo). Il campo si svuota al tocco e **non si disabilita mai** durante l'attesa: un campo disabilitato perde il fuoco e sul telefono la tastiera si chiudeva a ogni prodotto. Più aggiunte possono essere in volo insieme; in caso di errore il testo torna nel campo se è ancora vuoto (non per un doppione). La spunta è ottimistica con `useOptimistic`: la riga sparisce al tocco e ricompare da sola se il server rifiuta. Spunta con possibilità di annullare, eliminazione con conferma, comprati in sezione espandibile. Le righe mancanti dall’ultimo controllo hanno un richiamo neutro.

Controllo scontrino con fotocamera e selezione file separati, stati di caricamento e lettura. “Crea spesa da questo scontrino” apre un modulo precompilato; solo “Salva spesa” registra il movimento e tenta di allegare l’immagine. Un importo/data già presente viene segnalato con un link: è una verifica preventiva, non una garanzia transazionale contro richieste simultanee. WEBP resta accettato dal controllo ma non dal bucket degli allegati; l’eventuale allegato mancante viene segnalato.

**Condivisione verso l'app** (Android, app installata): dalla galleria o dalla fotocamera si condivide la foto (o il PDF) dello scontrino con Casa Nostra. Il service worker la parcheggia nella Cache Storage e manda a `/lista?condiviso=1`; la lista la riprende una volta sola (`takeSharedReceipt` in `lib/share-target.ts`, con un ref che regge il doppio effetto dello Strict Mode), toglie il parametro dall'URL e apre il controllo scontrino, che parte da solo con quel file: da lì "Crea spesa da questo scontrino" come sempre. Gli esiti storti (`vuoto`, `errore`, `non-pronto`) diventano un toast. iOS non supporta la destinazione di condivisione per le web app.

Il comportamento Telegram rimane quello documentato in `telegram-setup.md`: uno scontrino inviato al bot può creare la spesa con esito esplicito. I servizi di dominio restano condivisi.

## Assistente

Sheet Radix con focus contenuto, chiusura da tastiera e textarea. I pulsanti contestuali aprono un messaggio modificabile; non lo inviano automaticamente. Un solo invio attivo fino alla chiusura dello stream. Errori di rete conservano il testo e ricordano di verificare eventuali operazioni confermate.

Le istruzioni di presentazione nell’app chiedono una tabella Campo/Valore per il riepilogo prima della conferma di una spesa. La conferma resta esplicita; i tool e il motore sono condivisi con Telegram, che mantiene messaggi brevi.

## Statistiche

Intervalli basati sui giorni Europe/Rome; confronto fino al giorno equivalente del periodo precedente, con fine mese e anno bisestile gestiti. Le date effettive sono sempre visibili. Nessuna percentuale quando il termine precedente è zero.

Importi totali e conguagli restano distinti. Barre mensili con tabella consultabile e link ai movimenti; categorie con nome, importo, percentuale e link allo storico filtrato. Somme aggregate in centesimi.

## Attesa e scheletri

Ogni schermata privata ha il suo `loading.tsx`: `/`, `/spese`, `/spese/[id]`, `/spese/nuova`, `/lista`, `/conguaglio`, `/statistiche`, `/impostazioni`.

- **Lo scheletro ricalca il layout fisso della pagina che sta caricando**, non una lista generica di barre: stesse classi del contenitore (padding, `gap`, `max-width`, griglie `xl:`), stessi elementi fermi (barra dei filtri chiusa, barra sticky del conguaglio, intestazioni dei gruppi) e stesso numero di righe atteso. Quando i dati arrivano non si sposta niente sotto il dito.
- **Le altezze si fissano con `min-h-*` sul contenitore** — l'altezza vera viene dal box di testo o dal touch target da 44/48 px — e le barre dentro restano più sottili: sembrano testo, non blocchi pieni.
- **Quello che è disegnato dal bordo resta disegnato dal bordo**: chip, bottoni `outline` e la pista del `SegmentedControl` mantengono bordo e superficie veri, shimmera solo l'etichetta. Una pillola piena sembrerebbe un chip già selezionato.
- Niente segnaposto per il FAB: è fisso, non sposta nulla, e un cerchio che non risponde al tocco durante l'attesa confonde.
- Primitive in `components/ui/Skeleton.tsx` (`Skeleton`, `SkeletonPage`, `SkeletonListRow`, `SkeletonIconButton`, `SkeletonField`, `SkeletonChip`, `SkeletonSegmented`) e due segnaposto di dominio, `ExpenseRowSkeleton` e `SpendingRingSkeleton`, condivisi dalle schermate che mostrano gli stessi oggetti.
- Accessibilità: le barre sono `aria-hidden`, `SkeletonPage` marca `aria-busy` e annuncia l'attesa una volta sola con una riga `role="status"` in `sr-only`.
- Quando i dati arrivano, in home lo scheletro lascia il posto all'entrata a cascata descritta in "Home e conguaglio": stesse posizioni, nessuno spostamento.

## Accessibilità e aggiornamenti

- Controlli tattili almeno 44 px, generalmente 48 px; focus visibile, nomi accessibili e collegamento tra errori e campi.
- Sheet con header/footer fissi, safe area e compensazione della tastiera. Password visibile su richiesta.
- `MotionConfig reducedMotion="user"` e regole CSS per movimento ridotto.
- `SharedDataRefresh`: ogni 30 secondi quando la pagina è visibile e online, e al ritorno nella finestra/connessione, chiede a `/api/sync` l'impronta dei dati; ricarica la pagina (`router.refresh()`) solo se è cambiata o non è leggibile. Sospeso durante la modifica di campi e con dialog aperti. Non introduce una sottoscrizione Realtime o una scrittura in background.
- Dopo una Server Action che chiama `revalidatePath` non serve `router.refresh()`: la risposta porta già la pagina aggiornata. Gli esiti passati con `?ok=` (`FlashToast`) si tolgono dall'URL con `history.replaceState`, senza un secondo render.
- `PageTransition` anima solo l'entrata della pagina nuova, senza uscita né `mode="wait"`, e mai al primo caricamento. `PullToRefresh` ignora i gesti con una sheet aperta e gira finché il refresh non è davvero finito (`useTransition`).
- Importi: `formatEur` forza il separatore delle migliaia (`useGrouping: 'always'`). Node 22 e i browser hanno dati CLDR diversi per l'italiano (`1234,50 €` contro `1.234,50 €`) e il testo diverso rompeva l'idratazione di storico e statistiche. I formatter `Intl` sono creati una volta sola in `lib/fmt.ts`.
- Feedback offline e messaggi di errore descrivono l’azione disponibile senza esporre configurazioni interne.

## Verifica

`npm test` copre importi italiani, quote, categorie/compensazioni e periodi. `npm run lint`, `npx tsc --noEmit` e `npm run build` verificano l’integrazione. La QA visiva deve comprendere 320, 390, 768 e 1440 px, entrambi i temi, importi lunghi, nomi lunghi, pannelli, tastiera e focus. Esiti e limiti della sessione sono nel dev log.
