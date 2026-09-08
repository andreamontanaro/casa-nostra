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

L’anello compatto della home ha un testo alternativo con gli importi; il pannello espandibile mostra quote, anticipi, importi delle categorie e contributi al saldo con collegamenti allo storico. L’anello del conguaglio offre una legenda selezionabile anche da tastiera.

Il conguaglio completo usa il saldo della vista. La selezione parziale è un’anteprima della somma in centesimi dei contributi ottenuti da `v_expense_shares`; la RPC `register_settlement` con `p_expense_ids` ricalcola e registra atomicamente. Selezione vuota e saldo compensato sono stati distinti. La conferma chiede che il bonifico sia già stato eseguito; un riepilogo cambiato mentre la conferma è aperta richiede una nuova verifica.

## Spese

- Importo prominente con tastiera decimale, parsing condiviso tra form e Server Actions (`lib/expense-input.ts`).
- Categorie in griglia con etichette intere, divisione modificabile e anteprima nominativa delle quote. I default di dominio già presenti restano invariati.
- Bozza recuperabile esplicitamente da sessionStorage per utente. Dopo un errore i campi restano nel form.
- Salvataggio senza riga fittizia nella lista. Gli allegati vengono caricati sull’id restituito; i tentativi successivi caricano soltanto i file mancanti. La sheet di inserimento resta aperta durante il salvataggio e si sblocca dopo l’esito.
- Storico: mese libero, stato, categoria e ricerca nell’URL; intervalli `da/a` dai grafici. Dettaglio in consultazione e modifica esplicita in sheet; ritorno allo storico conserva i filtri.
- Spese saldate in consultazione. Eliminazioni con conferma.

## Lista e scontrini

Aggiunta rapida del solo nome (categoria Cibo, urgenza normale); quantità e altri dettagli nel form. Spunta con possibilità di annullare, eliminazione con conferma, comprati in sezione espandibile. Le righe mancanti dall’ultimo controllo hanno un richiamo neutro.

Controllo scontrino con fotocamera e selezione file separati, stati di caricamento e lettura. “Crea spesa da questo scontrino” apre un modulo precompilato; solo “Salva spesa” registra il movimento e tenta di allegare l’immagine. Un importo/data già presente viene segnalato con un link: è una verifica preventiva, non una garanzia transazionale contro richieste simultanee. WEBP resta accettato dal controllo ma non dal bucket degli allegati; l’eventuale allegato mancante viene segnalato.

Il comportamento Telegram rimane quello documentato in `telegram-setup.md`: uno scontrino inviato al bot può creare la spesa con esito esplicito. I servizi di dominio restano condivisi.

## Assistente

Sheet Radix con focus contenuto, chiusura da tastiera e textarea. I pulsanti contestuali aprono un messaggio modificabile; non lo inviano automaticamente. Un solo invio attivo fino alla chiusura dello stream. Errori di rete conservano il testo e ricordano di verificare eventuali operazioni confermate.

Le istruzioni di presentazione nell’app chiedono una tabella Campo/Valore per il riepilogo prima della conferma di una spesa. La conferma resta esplicita; i tool e il motore sono condivisi con Telegram, che mantiene messaggi brevi.

## Statistiche

Intervalli basati sui giorni Europe/Rome; confronto fino al giorno equivalente del periodo precedente, con fine mese e anno bisestile gestiti. Le date effettive sono sempre visibili. Nessuna percentuale quando il termine precedente è zero.

Importi totali e conguagli restano distinti. Barre mensili con tabella consultabile e link ai movimenti; categorie con nome, importo, percentuale e link allo storico filtrato. Somme aggregate in centesimi.

## Accessibilità e aggiornamenti

- Controlli tattili almeno 44 px, generalmente 48 px; focus visibile, nomi accessibili e collegamento tra errori e campi.
- Sheet con header/footer fissi, safe area e compensazione della tastiera. Password visibile su richiesta.
- `MotionConfig reducedMotion="user"` e regole CSS per movimento ridotto.
- `SharedDataRefresh`: aggiornamento ogni 30 secondi quando la pagina è visibile e online, e al ritorno nella finestra/connessione. Sospeso durante la modifica di campi e con dialog aperti. Non introduce una sottoscrizione Realtime o una scrittura in background.
- Feedback offline e messaggi di errore descrivono l’azione disponibile senza esporre configurazioni interne.

## Verifica

`npm test` copre importi italiani, quote, categorie/compensazioni e periodi. `npm run lint`, `npx tsc --noEmit` e `npm run build` verificano l’integrazione. La QA visiva deve comprendere 320, 390, 768 e 1440 px, entrambi i temi, importi lunghi, nomi lunghi, pannelli, tastiera e focus. Esiti e limiti della sessione sono nel dev log.
