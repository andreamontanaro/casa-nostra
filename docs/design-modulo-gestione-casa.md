# Progettazione — Modulo "Gestione casa"

> Stato: **proposta di design**, settembre 2026. Nessuna riga di codice e nessuna
> migrazione applicata. Questo documento serve a decidere *cosa* costruire e
> soprattutto *cosa non* costruire, prima di aprire l'editor.

---

## 1. Perché questo modulo, e la lezione di "Le mie auto"

Casa Nostra rende trasparente una cosa che tra conviventi si misura male: **chi ha
anticipato quanto**. Il modulo "Gestione casa" prova a fare lo stesso con la
seconda cosa che si misura male, e che genera molto più attrito della prima:
**chi fa cosa in casa**.

C'è però un precedente da tenere presente. Il 2 settembre il modulo "Le mie auto"
è stato rimosso del tutto — codice, tabelle, documentazione — perché era
*owner-scoped, invisibile all'altro partner, fuori dallo scope condiviso*
(`docs/dev-log-2026-09-02.md`). La lezione operativa non è "niente moduli nuovi",
è: **un modulo sopravvive solo se è condiviso per natura e si usa tutti i
giorni**. Le faccende domestiche superano entrambi i test meglio delle spese
stesse: sono condivise per definizione e la frequenza di interazione è
giornaliera, non mensile.

Il criterio di successo del modulo è quindi uno solo, mutuato dai requisiti MVP:
**registrare una faccenda fatta deve costare un tap e meno di 5 secondi**. Se
costa di più, nessuno lo farà dopo aver lavato i piatti alle 22:30, i dati
saranno incompleti, e un modulo con dati incompleti è peggio di nessun modulo —
perché il punteggio parziale diventa una fonte di discussione invece che di
chiarezza.

---

## 2. Il rischio: la gamification a due è quasi sempre tossica

Vale la pena essere espliciti sul motivo, perché è tutto il design che segue a
discendere da qui.

La gamification funziona bene su grandi numeri (classifiche con centinaia di
persone, dove il confronto è astratto) e funziona male con **N = 2**. Con due
giocatori:

* ogni classifica è un **confronto diretto e personale**: non esiste "sono
  ventesimo", esiste solo "sto perdendo contro la persona con cui vivo";
* ogni punteggio cumulativo diventa un **debito morale**: 400 XP contro 120 XP
  non è un gioco, è la prova documentale di un'accusa;
* il divario, una volta creato, **non è più recuperabile**, quindi chi è
  indietro smette di giocare e chi è avanti ha in mano un argomento;
* l'app diventa uno **strumento di rinfaccio**: "guarda l'app" è la frase che
  chiude una discussione, non che la apre.

C'è un secondo rischio, più sottile, specifico di quest'app: **Casa Nostra sa già
contare i soldi**. La tentazione di collegare i due moduli ("chi fa meno faccende
paga una quota maggiore") va respinta senza discussione. Nel momento in cui una
faccenda ha un prezzo, l'altro può *comprarsi* il diritto di non farla, e la
collaborazione domestica diventa una transazione. Sarebbe la fine del modulo e,
verosimilmente, un problema che l'app non dovrebbe creare.

Sotto, otto principi che tengono la gamification dal lato utile.

---

## 3. Principi di design

**1. L'obiettivo primario è condiviso, non individuale.**
Il numero grande in cima alla schermata è quello **della casa**, non della
persona: XP della settimana accumulati da entrambi verso un obiettivo comune,
più la *striscia* (streak) di settimane in cui l'obiettivo è stato raggiunto. Si
vince o si perde insieme. Il contributo individuale esiste, ma non è mai l'eroe
della pagina.

**2. Nessun debito di faccende.**
Le spese accumulano un saldo perché quel saldo si chiude con un bonifico. Le
faccende **non hanno un conguaglio**: nessun "mi devi 12 piatti". La conseguenza
tecnica è netta — niente `net_position` delle faccende, niente vista di saldo,
niente RPC di pareggio. È l'unica differenza architetturale importante rispetto
al modulo spese, ed è voluta.

**3. Gli XP si azzerano.**
Il punteggio è **stagionale**: la stagione è la settimana (per l'obiettivo di
casa) e il mese (per i titoli). Il totale storico non viene mai mostrato come
metrica di confronto. Azzerare regolarmente è il meccanismo che impedisce
matematicamente al divario di diventare incolmabile: ogni lunedì si riparte da
zero a zero.

**4. Il peso è nello sforzo, non nel conteggio.**
Ogni faccenda ha un valore in XP fissato *a catalogo*, tarato sui minuti reali
(pulire il bagno ≈ 25, portare fuori la spazzatura ≈ 5). Il conteggio nudo delle
faccende premierebbe chi ne fa dieci da trenta secondi. Il valore è deciso una
volta insieme e modificabile nelle impostazioni del modulo: se uno dei due pensa
che stendere il bucato valga più di 10, si cambia il numero e non se ne parla
più — la discussione avviene sul catalogo, a freddo, non sul singolo evento.

**5. Nessuno assegna niente all'altro.**
Questa è la regola che salva il modulo. Un'app che permette di assegnare "pulisci
il bagno entro domani" al partner è un **proxy per il rimprovero**, con la
aggravante di essere scritto e con notifica. Il modello è invece **backlog +
claim**: c'è una lista condivisa di cose da fare, si prende quello che si fa. Al
massimo l'app *suggerisce* chi tocca, sulla base di chi l'ha fatta l'ultima
volta, e il suggerimento non è vincolante né notificato.

**6. Riconoscere vale quanto fare.**
Su ogni faccenda completata dall'altro si può lasciare un *kudos* (una reazione:
❤️ 🙏 👏 💪). Il kudos accredita XP **all'obiettivo della casa**, non a chi lo
riceve né a chi lo dà. Meccanicamente è il modo di rendere il ringraziamento una
mossa del gioco: l'unico modo di "fare punti" senza pulire è accorgersi di quello
che ha fatto l'altro.

**7. Mai in negativo, mai in rosso.**
Niente penalità, niente XP tolti, niente attività "scadute" in rosso con badge di
allarme. Una faccenda non fatta è semplicemente ancora in lista, con un garbato
"da 4 giorni". L'app non usa mai le parole "in ritardo", "hai fatto meno",
"tocca a te". Il rosso, in questo modulo, non esiste come colore semantico —
esattamente come nel modulo spese il saldo non è mai rosso perché è un saldo di
coppia (`docs/wiki/08-patterns.md`).

**8. La gamification si può spegnere.**
Un interruttore nelle impostazioni nasconde XP, obiettivo, striscia e titoli. Con
l'interruttore spento resta una **lista di faccende condivisa con lo storico di
chi le ha fatte l'ultima volta**, che deve essere utile da sola. Questo è anche
il test di progettazione: se il modulo senza punteggio non serve a niente,
allora il punteggio sta compensando un prodotto debole.

### L'equilibrio, e come si mostra

Il dato "chi ha fatto quanto questa settimana" esiste ed è legittimo: è il motivo
per cui si costruisce il modulo. Il punto è **come** si mostra.

* Una sola barra orizzontale, due segmenti con i colori dei due profili, senza
  numeri sopra.
* **Zona morta ampia**: qualsiasi ripartizione fra 35% e 65% viene etichettata
  "in equilibrio", senza percentuali e senza evidenziare nessuno dei due. Le
  settimane normali devono quindi apparire *tutte uguali*.
* Le percentuali compaiono solo fuori dalla zona morta, e con un testo neutro e
  orientato al futuro ("questa settimana ha spinto soprattutto Andrea"), mai
  accusatorio verso chi ha fatto meno.
* La barra si riferisce **sempre e solo alla settimana corrente**. Non esiste una
  vista "equilibrio storico degli ultimi 6 mesi": sarebbe l'arma da rinfaccio
  definitiva. Lo storico serve a ricordare *quando* è stata pulita l'ultima
  volta una cosa, non chi è in credito di fatica.

---

## 4. Titoli

I titoli sono la parte più divertente e quella più facile da sbagliare. Regole:

* **Non sono gerarchici.** Niente "Livello 5" contro "Livello 2", niente
  "Campione" contro "Sfidante". Un titolo descrive *cosa fai spesso*, non
  *quanto vali*: "Signore delle Stoviglie", "Custode del Secchio", "Sentinella
  della Lavatrice", "Ammiraglio dei Fornelli", "Giardiniere del Davanzale".
* **Non sono comparativi.** Un titolo si ottiene superando una soglia assoluta
  ("8 volte in un mese"), mai battendo l'altro. È strutturalmente possibile che
  entrambi abbiano lo stesso titolo nello stesso mese, ed è un esito
  desiderabile, non un bug.
* **Premiano la varietà e la costanza, non il volume.** Esempi: *Tuttofare* —
  almeno una faccenda in 5 aree diverse nel mese; *Persona Affidabile* — la
  stessa faccenda ricorrente completata per 4 settimane di fila; *Gentile* — 10
  kudos lasciati in un mese.
* **Sono mensili e si rinnovano.** A inizio mese la bacheca è vuota per
  entrambi. Un titolo perso non è una retrocessione: è una stagione nuova.
* **Ci sono titoli di casa**, che si ottengono insieme e si mostrano su un'unica
  card: "Casa in Ordine" (obiettivo settimanale raggiunto 4 settimane di fila).

Implementazione consigliata: **i titoli non sono una tabella**. Sono predicati
deterministici in `lib/chores/titles.ts` valutati sugli aggregati del mese. Dato
che i log sono di fatto immutabili, ricalcolare il mese scorso dà sempre lo
stesso risultato: niente tabella da mantenere, niente cron di assegnazione a fine
mese, niente stato che può divergere dai dati. Cambiare le soglie è una modifica
di codice, non una migrazione.

---

## 5. Modello di dominio (bozza)

Tre tabelle. Segue le convenzioni dello schema esistente: enum dedicato, RLS via
`public.is_authorized_user()`, commenti sulle tabelle, indici sulle query
frequenti, snapshot dei valori che possono essere ritarati nel tempo.

```sql
-- Aree della casa: servono a raggruppare in UI e alimentano il titolo "Tuttofare".
CREATE TYPE chore_area AS ENUM (
  'cucina', 'bagno', 'pulizie', 'spazzatura', 'bucato', 'spesa', 'manutenzione', 'altro'
);

-- Catalogo delle faccende. Modificabile dai due utenti dalle impostazioni del modulo.
CREATE TABLE public.chore_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (length(trim(name)) > 0),
  area          chore_area NOT NULL,
  effort_xp     int NOT NULL CHECK (effort_xp BETWEEN 1 AND 100),
  cadence_days  int CHECK (cadence_days > 0),   -- NULL = nessuna ricorrenza attesa
  active        boolean NOT NULL DEFAULT true,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Registro dei completamenti. Append-only nell'uso normale.
CREATE TABLE public.chore_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid REFERENCES public.chore_templates(id) ON DELETE SET NULL,
  title        text NOT NULL CHECK (length(trim(title)) > 0),  -- snapshot del nome
  area         chore_area NOT NULL,                            -- snapshot
  xp           int NOT NULL CHECK (xp >= 0),                   -- snapshot
  done_by      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  done_at      timestamptz NOT NULL DEFAULT now(),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chore_logs_done_at   ON public.chore_logs (done_at DESC);
CREATE INDEX idx_chore_logs_template  ON public.chore_logs (template_id, done_at DESC);
CREATE INDEX idx_chore_logs_done_by   ON public.chore_logs (done_by, done_at DESC);

-- Reazioni sulle faccende dell'altro.
CREATE TABLE public.chore_kudos (
  log_id        uuid NOT NULL REFERENCES public.chore_logs(id) ON DELETE CASCADE,
  from_user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji         text NOT NULL DEFAULT '❤️',
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (log_id, from_user_id)
);
```

Note di modellazione:

* **`title`, `area` e `xp` sono snapshot** sulla riga di log, esattamente come
  `custom_other_share` fotografa la quota al momento della spesa. Se fra sei mesi
  decidete che il bagno vale 30 XP invece di 25, la storia non si riscrive e le
  strisce passate restano quelle che erano.
* **`template_id` è nullable con `ON DELETE SET NULL`**: si può registrare una
  faccenda fuori catalogo ("smontato la tenda del balcone") e si può togliere una
  voce dal catalogo senza perdere lo storico.
* **Nessuna tabella di assegnazioni**, per il principio 5. Non c'è `assigned_to`,
  non c'è `due_date` per persona. La scadenza è derivata dalla cadenza, ed è
  della casa.
* **Il divieto di auto-kudos sta in RLS**, non nel client:

```sql
CREATE POLICY "chore_kudos_insert_other" ON public.chore_kudos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_authorized_user()
    AND from_user_id = auth.uid()
    AND (SELECT done_by FROM public.chore_logs WHERE id = log_id) <> auth.uid()
  );
```

### Viste di calcolo

Come per il saldo, **i conti stanno nel database** — non ricalcolati a mano nel
client, nell'assistente e nel bot Telegram, che divergerebbero al primo refactor.

* `v_chore_status` — per ogni template attivo: ultimo completamento (`done_at`,
  `done_by`) via `LATERAL`, giorni trascorsi, e `due_in_days` derivato da
  `cadence_days`. È la vista che ordina la schermata principale. **Nessuna riga
  viene generata dalla ricorrenza**: lo stato "da fare" è calcolato, non
  materializzato. Niente cron, niente righe fantasma da pulire.
* `v_chore_week` — XP e conteggi per utente per settimana ISO
  (`date_trunc('week', done_at)`), inclusi gli XP da kudos attribuiti alla casa.
  Alimenta obiettivo, barra di equilibrio e striscia.
* `v_chore_month` — gli stessi aggregati per mese, più il conteggio di aree
  distinte e la lunghezza delle serie per template: è l'input dei titoli.

### Catalogo iniziale (seed proposto)

XP ≈ minuti di lavoro, arrotondati. Da ritarare insieme prima del rilascio.

| Faccenda | Area | XP | Cadenza |
|---|---|---:|---:|
| Portare fuori la spazzatura | spazzatura | 5 | 2 gg |
| Vetro / plastica / carta | spazzatura | 8 | 7 gg |
| Caricare e avviare la lavastoviglie | cucina | 8 | 1 g |
| Svuotare la lavastoviglie | cucina | 5 | 1 g |
| Lavare i piatti a mano | cucina | 15 | 1 g |
| Riordinare cucina e tavolo | cucina | 10 | 1 g |
| Pulire il piano cottura | cucina | 10 | 3 gg |
| Cucinare il pasto principale | cucina | 20 | 1 g |
| Fare la spesa | spesa | 30 | 7 gg |
| Aspirare / spazzare | pulizie | 20 | 4 gg |
| Lavare i pavimenti | pulizie | 25 | 7 gg |
| Pulire il bagno | bagno | 25 | 7 gg |
| Fare la lavatrice | bucato | 10 | 3 gg |
| Stendere il bucato | bucato | 10 | 3 gg |
| Ritirare e piegare | bucato | 15 | 4 gg |
| Cambiare le lenzuola | bucato | 15 | 14 gg |
| Innaffiare le piante | altro | 5 | 4 gg |

Obiettivo settimanale di casa suggerito: **250 XP**, cioè circa la somma delle
cadenze sopra. Va tarato al ribasso dopo due settimane di uso reale: un obiettivo
che si manca sempre è demoralizzante, uno che si raggiunge il mercoledì non dice
niente.

---

## 6. Interfaccia e navigazione

Rotta nuova `/casa`, dentro il gruppo privato `app/(app)/`. Riusa integralmente
il design system esistente: `Card`, `ListRow`, `Chip`, `SegmentedControl`,
`Sheet`, i preset spring di `lib/motion.ts`, l'accento teal e il token
`--positive`. **Nessun nuovo colore e nessuna nuova primitiva** se non un
`ChoreRow` e un `XpBar`, entrambi costruiti sopra quelle esistenti.

**Schermata `/casa`** (dall'alto):

1. **Card "La nostra settimana"** — barra XP verso l'obiettivo con i due
   segmenti profilo, la striscia ("3ª settimana di fila"), e sotto la riga di
   equilibrio con la zona morta descritta sopra. Tono positivo, mai allarme.
2. **"Da fare"** — lista ordinata per urgenza (`due_in_days` crescente), ogni
   riga con icona d'area, nome, sottotitolo "ultima volta 3 giorni fa · Andrea",
   e un pulsante **"Fatto"** a destra, alto almeno 44px. Un tap registra,
   ottimisticamente, con la stessa meccanica di `HomeShell.tsx`: la riga scivola
   in "Fatto di recente" prima che la Server Action risponda. Nessun form, nessun
   dialog di conferma — non è un'azione distruttiva, e la conferma ucciderebbe i
   5 secondi. Annullamento tramite toast "Annulla" per qualche secondo.
3. **"Fatto di recente"** — feed degli ultimi completamenti dei due, con il
   pulsante kudos sulle righe dell'altro.
4. **"Bacheca"** — i titoli del mese dei due profili, affiancati, più i titoli di
   casa. Vuota a inizio mese, con un testo che spiega come si ottengono.

Un **FAB** apre uno `Sheet` per la faccenda fuori catalogo (nome, area, XP
suggeriti). Una **card compatta in home** mostra le 2 faccende più urgenti con il
tap "Fatto" diretto: è il percorso che rende davvero realistico il criterio dei 5
secondi, perché la home è la schermata che si apre.

**Navigazione.** La `BottomNav` ha già 4 voci. Consiglio di **non** farne 5: le
faccende sono l'interazione più frequente dell'app, il conguaglio la più rara.
La proposta è nav = **Home · Spese · Casa · Conguaglio**, con **Statistiche
spostata nel Sheet "Menu"** dell'header, accanto a Impostazioni. In alternativa,
5 voci: sta nei `max-w-lg`, ma ogni tab scende sotto i 72px ed è un compromesso
peggiore.

---

## 7. Assistente IA e Telegram

Il motore dell'assistente è condiviso (`lib/assistant/`) e serve sia la chat
interna sia il bot: si aggiunge una volta sola lì.

* Tool nuovi: **`complete_chore`** (accetta il nome in linguaggio naturale e lo
  risolve sul catalogo — "ho lavato i piatti" deve funzionare), **`list_chores`**
  (cosa manca), **`get_house_week`** (com'è messa la settimana).
* Il `system instruction` va esteso con **le regole di tono**: l'assistente non
  fa mai confronti fra i due, non sollecita e non risponde a domande del tipo
  "chi ha fatto di più" con una classifica, ma con il quadro della settimana di
  casa. Questa parte del prompt è tanto importante quanto lo schema: è il punto
  in cui la tossicità rientrerebbe dalla finestra.

Su Telegram, la regola è **niente notifica su ogni faccenda**. Un messaggio nel
gruppo a ogni piatto lavato è spam, e soprattutto rende il punteggio l'oggetto
costante della conversazione. Proposta:

* **immediato** solo per gli eventi rari e positivi: obiettivo settimanale
  raggiunto, nuovo titolo, striscia che si allunga;
* **mai** un messaggio su ciò che *non* è stato fatto. Il bot che scrive "la
  spazzatura è lì da tre giorni" è esattamente il rimprovero automatizzato che il
  principio 5 esclude. Se in futuro si vuole un promemoria, deve essere neutro,
  rivolto al gruppo e non alla persona ("stasera tocca alla spazzatura"), e
  disattivabile;
* un eventuale **digest serale** richiede uno scheduler (Vercel Cron): è infra
  nuova, quindi non prima della fase 3, e comunque opzionale.

Vale la proprietà già stabilita: senza `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`
tutto il percorso Telegram esce subito, e le notifiche restano fuori dal percorso
critico con `after()`.

---

## 8. Fasi di rilascio

Deliberatamente incrementali, perché la lezione del modulo auto è che l'uso reale
si verifica prima di investire.

* **Fase 1 — la lista che serve davvero.** Schema (3 tabelle + viste), catalogo
  seed, rotta `/casa`, completamento in un tap con UI ottimistica, "ultima volta
  / da quanto", card in home, voce di navigazione. **XP registrati ma nascosti**:
  l'interfaccia non mostra punteggi. Si usa per due settimane e si guarda se le
  righe di log arrivano davvero.
* **Fase 2 — il gioco.** Obiettivo settimanale, striscia, barra di equilibrio con
  zona morta, kudos, interruttore per spegnere tutto. Ritaratura degli XP e
  dell'obiettivo sui dati raccolti in fase 1.
* **Fase 3 — i titoli e i canali.** Bacheca mensile, tool dell'assistente,
  notifiche Telegram sui soli eventi rari.

Ogni fase è rilasciabile e reversibile: se la fase 2 rende l'atmosfera peggiore
invece che migliore, si torna alla fase 1 spegnendo un interruttore, senza toccare
i dati.

---

## 9. Cose da NON fare in questo modulo

Nello spirito della lista in `AGENTS.md`:

* **Non collegare le faccende ai soldi.** Nessuna conversione XP → euro, nessuna
  quota di spesa che dipende dalle faccende, nessun "conguaglio delle faccende".
* **Non introdurre l'assegnazione di compiti al partner**, con o senza scadenza,
  con o senza notifica.
* **Non mostrare classifiche cumulative** né grafici storici di chi ha fatto di
  più. Lo storico serve alle cose, non alle persone.
* **Non usare il rosso, le penalità, gli XP negativi** o la parola "scaduto".
* **Non materializzare le occorrenze ricorrenti** con un job: lo stato "da fare"
  si deriva dall'ultimo log e dalla cadenza.
* **Non duplicare la logica di aggregazione** fra client, assistente e bot: sta
  nelle viste.
* **Non ricalcolare gli XP storici** quando si ritara il catalogo: sono snapshot.

---

## 10. Decisioni aperte

Da chiudere prima della fase 1:

1. **Navigazione**: nav a 4 voci con Statistiche spostata nel menu (consigliata),
   oppure nav a 5 voci?
2. **Stagione degli XP**: settimana per l'obiettivo e mese per i titoli
   (consigliata), oppure tutto mensile?
3. **Kudos**: dentro dalla fase 2, o si parte senza per non aggiungere un gesto
   in più da fare?
4. **Faccende fuori catalogo**: ammesse da subito (consigliata: sì, altrimenti il
   catalogo diventa una gabbia), o solo catalogo chiuso?
5. **Valori XP e obiettivo settimanale**: la tabella della sezione 5 è una
   proposta e va rivista da entrambi — è l'unico punto in cui un disaccordo va
   risolto *prima*, a freddo, e non davanti al lavello.
